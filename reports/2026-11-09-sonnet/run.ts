// Test Sonnet 5.5 pour la rédaction et la révision (tri et vérification restent sur Haiku 5.5). AUCUNE écriture en base.
// Pour chaque nouvelle : rédaction (modèle testé) → preuves → vérification (Haiku) → si révision : révision (modèle testé)
// → vérification passe 2. Mêmes prompts, options et règles de décision que draft/, revise/ et verify/ en production.
// Les deux modèles rédacteurs passent sur les mêmes articles pour mesurer les tokens réels de chacun.
// Entrées (lecture seule, `supabase db query --linked -o json`) : stories.json, config.json, themes.json.
// Usage : node run.ts <dossier des entrées>
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { parseConfig } from "../../supabase/functions/_shared/pipeline/config.ts";
import { buildDraftPrompt, buildRevisePrompt, decideDraftOutput, type Draft, type DraftOptions } from "../../supabase/functions/_shared/pipeline/draft.ts";
import { checkEvidence } from "../../supabase/functions/_shared/pipeline/evidence.ts";
import type { Prompt } from "../../supabase/functions/_shared/pipeline/types.ts";
import { buildVerifyPrompt, decideVerify, parseVerify, revisableProblems, type VerifyProblem } from "../../supabase/functions/_shared/pipeline/verify.ts";

interface StoryRow {
  id: string; theme_id: string; status: string; publish_date: string | null;
  title_main: string; title_accent: string | null; summary: string;
  source_name: string; source_url: string; title: string; published_at: string | null; full_text: string;
}

const HAIKU = "claude-haiku-5-5";
const SONNET = "claude-sonnet-5-5";
// $ par million de tokens (docs Claude API) ; écriture en cache = 1,25 × l'entrée.
const PRICE: Record<string, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  [HAIKU]: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  [SONNET]: { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
};

const dir = process.argv[2];
if (!dir) throw new Error("usage : node run.ts <dossier>");
const rows = <T>(file: string): T[] => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")).rows as T[];
const configResult = parseConfig(rows<{ key: string; value: unknown }>("config.json"));
if (!configResult.ok) throw new Error(configResult.error);
const config = configResult.value;
const themes = rows<{ id: string; label: string; followed: boolean }>("themes.json").filter((t) => t.followed).map(({ id, label }) => ({ id, label }));
const stories = rows<StoryRow>("stories.json");

const env = readFileSync(new URL("../../supabase/functions/.env", import.meta.url), "utf8");
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || /^ANTHROPIC_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (!apiKey) throw new Error("clé ANTHROPIC_API_KEY absente");
const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 180_000 });

interface Usage { calls: number; input: number; cacheWrite: number; cacheRead: number; output: number; cost: number }
const usage: Record<string, Usage> = {};
const add = (key: string, model: string, u: Anthropic.Usage) => {
  const p = PRICE[model];
  if (!p) throw new Error(`prix inconnu : ${model}`);
  const cur = usage[key] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, cost: 0 };
  cur.calls++; cur.input += u.input_tokens; cur.cacheWrite += u.cache_creation_input_tokens ?? 0;
  cur.cacheRead += u.cache_read_input_tokens ?? 0; cur.output += u.output_tokens;
  cur.cost += (u.input_tokens * p.input + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite
    + (u.cache_read_input_tokens ?? 0) * p.cacheRead + u.output_tokens * p.output) / 1e6;
};

// Même appel que askModel (_shared/claude.ts) ; le compte des tokens est rangé par (modèle rédacteur, étape).
async function ask(model: string, key: string, prompt: Prompt, maxTokens: number): Promise<{ text: string; stop: string | null }> {
  const r = await client.messages.create({
    model, max_tokens: maxTokens,
    thinking: { type: "adaptive" }, output_config: { effort: "low" },
    system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt.user }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  add(key, model, r.usage);
  return { text: r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n"), stop: r.stop_reason };
}

type Outcome = { outcome: string; reason: string | null; draft: Draft | null; first: Draft | null; problems: VerifyProblem[] };

async function writeDraft(model: string, step: "draft" | "revise", build: (o: DraftOptions) => Prompt): Promise<{ draft: Draft } | { fail: string }> {
  let options: DraftOptions = {};
  for (let attempt = 1; ; attempt++) {
    const reply = await ask(model, `${model}:${step}`, build(options), 8192);
    if (reply.stop === "refusal" || reply.stop === "max_tokens") return { fail: `${step}_incomplete: ${reply.stop}` };
    const out = decideDraftOutput(reply.text, attempt, config, step);
    if (out.action === "retry_shorter") { options = { shorten: out.over }; continue; }
    if (out.action === "reject") return { fail: out.reason };
    if (out.action === "not_good_news") return { fail: `not_good_news: ${out.reason}` };
    return { draft: out.draft };
  }
}

async function pipeline(story: StoryRow, model: string): Promise<Outcome> {
  const article = { title: story.title, sourceName: story.source_name, url: story.source_url, publishedAt: story.published_at, fullText: story.full_text };
  const first = await writeDraft(model, "draft", (o) => buildDraftPrompt(article, config, o));
  if ("fail" in first) return { outcome: "rejected", reason: first.fail, draft: null, first: null, problems: [] };
  let draft = first.draft;
  let previous: VerifyProblem[] = [];
  for (let pass = 1; pass <= config.verify_max_passes; pass++) {
    const evidence = checkEvidence(draft.claims, story.full_text);
    if (!evidence.ok) return { outcome: "rejected", reason: `evidence_missing: ${evidence.missing.length}`, draft, first: first.draft, problems: [] };
    const reply = await ask(HAIKU, `${model}:verify`, buildVerifyPrompt(article, draft, { pass, previousProblems: previous, theme: { current: story.theme_id, available: themes } }), 4096);
    const parsed = parseVerify(reply.text);
    if (!parsed.ok) return { outcome: "rejected", reason: `verify_parse_error`, draft, first: first.draft, problems: [] };
    const decision = decideVerify(parsed.value, draft, pass, config, previous);
    if (decision.decision !== "revise") return { outcome: decision.decision, reason: decision.reason, draft, first: first.draft, problems: parsed.value.problems };
    previous = revisableProblems(parsed.value.problems);
    const current = draft;
    const revised = await writeDraft(model, "revise", (o) => buildRevisePrompt(article, current, previous, config, o));
    if ("fail" in revised) return { outcome: "rejected", reason: revised.fail, draft, first: first.draft, problems: parsed.value.problems };
    draft = revised.draft;
  }
  return { outcome: "rejected", reason: "passes épuisées", draft, first: first.draft, problems: [] };
}

const results = [];
for (const story of stories) {
  const [haiku, sonnet] = await Promise.all([pipeline(story, HAIKU), pipeline(story, SONNET)]);
  results.push({
    id: story.id, theme: story.theme_id, status: story.status, publish_date: story.publish_date,
    production: { title_main: story.title_main, title_accent: story.title_accent, summary: story.summary },
    haiku, sonnet,
  });
  process.stderr.write(".");
}
writeFileSync(new URL("./resultats.json", import.meta.url), `${JSON.stringify({ results, usage }, null, 2)}\n`);
console.log(JSON.stringify(usage, null, 1));
for (const r of results) console.log(r.id.slice(0, 8), "haiku", r.haiku.outcome, "| sonnet", r.sonnet.outcome, r.sonnet.reason ?? "");
