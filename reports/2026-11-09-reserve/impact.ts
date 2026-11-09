// Score d'impact de la réserve (anciennes nouvelles reprises), AUCUNE écriture en base.
// Même règle que le tri en production : même prompt (buildTriagePrompt), même modèle et mêmes options que
// triage/index.ts, puis applyEditorialRules + assessTriage avec la config de production.
// Entrées (exportées en lecture seule par `supabase db query --linked -o json`) : stories.json, config.json, themes.json.
// Usage : node impact.ts <dossier des entrées>
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { parseConfig } from "../../supabase/functions/_shared/pipeline/config.ts";
import { applyEditorialRules, assessTriage } from "../../supabase/functions/_shared/pipeline/editorial.ts";
import { buildTriagePrompt, parseTriage } from "../../supabase/functions/_shared/pipeline/triage.ts";

interface StoryRow {
  id: string; theme_id: string; status: string; publish_date: string | null; old_score: number;
  title_main: string; title_accent: string | null; title: string; snippet: string | null;
  source_name: string; trust_level: number;
}

const dir = process.argv[2];
if (!dir) throw new Error("usage : node impact.ts <dossier>");
const rows = <T>(file: string): T[] => JSON.parse(readFileSync(`${dir}/${file}`, "utf8")).rows as T[];

const configResult = parseConfig(rows<{ key: string; value: unknown }>("config.json"));
if (!configResult.ok) throw new Error(`config : ${configResult.error}`);
const config = configResult.value;
const themes = rows<{ id: string; label: string }>("themes.json");
const stories = rows<StoryRow>("stories.json");

const env = readFileSync(new URL("../../supabase/functions/.env", import.meta.url), "utf8");
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || /^ANTHROPIC_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (!apiKey) throw new Error("clé ANTHROPIC_API_KEY absente");
// Modèle du tri lu dans _shared/claude.ts (module Deno, non importable ici).
const TRIAGE_MODEL = /triage:\s*"([^"]+)"/.exec(readFileSync(new URL("../../supabase/functions/_shared/claude.ts", import.meta.url), "utf8"))?.[1];
if (!TRIAGE_MODEL) throw new Error("modèle du tri introuvable");
const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 90_000 });

async function triage(story: StoryRow) {
  const prompt = buildTriagePrompt({ title: story.title, snippet: story.snippet ?? "", sourceName: story.source_name }, themes);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await client.messages.create({
      model: TRIAGE_MODEL, max_tokens: 1024,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system: prompt.system, messages: [{ role: "user", content: prompt.user }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    const parsed = parseTriage(text);
    if (parsed.ok) return parsed.value;
  }
  throw new Error(`tri illisible : ${story.id}`);
}

const results = [];
for (const story of stories) {
  const raw = await triage(story);
  const ruled = applyEditorialRules(raw, { themes: config.followed_themes, exception: config.unfollowed_exception });
  const assessed = assessTriage(ruled.triage, story.trust_level, config);
  const reason = ruled.reason ?? assessed.reason;
  results.push({
    id: story.id, theme: story.theme_id, status: story.status, publish_date: story.publish_date,
    title: `${story.title_main} ${story.title_accent ?? ""}`.trim(), source: story.source_name,
    old_score: story.old_score, base: assessed.base, impact: assessed.impact, score: assessed.score,
    passes: reason === null, reason,
    fields: {
      concrete: raw.concrete, accomplished: raw.accomplished, closeness: raw.closeness, magnitude: raw.magnitude,
      before_after: raw.before_after, preliminary: raw.preliminary, too_technical: raw.too_technical,
      study_subject: raw.study_subject, kind: raw.kind,
    },
  });
  process.stderr.write(".");
}
results.sort((a, b) => Number(b.passes) - Number(a.passes) || b.score - a.score);
writeFileSync(new URL("./impact.json", import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
for (const r of results) {
  console.log(`${r.passes ? "OK " : "NON"} ${r.score.toFixed(2)} impact ${r.impact.toFixed(2)} base ${r.base.toFixed(2)} ${(r.reason ?? "").padEnd(12)} ${r.theme.padEnd(10)} ${r.publish_date ?? "réserve   "} ${r.title}`);
}
