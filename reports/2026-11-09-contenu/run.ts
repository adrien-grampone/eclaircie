// Test à blanc, AUCUNE écriture en base : réécriture de 20 nouvelles (nouvelle consigne) + relecture par le
// vérificateur actuel ; re-tri des articles des 2 derniers jours avec le score d'impact. Haiku 5.5, comme en prod.
// Usage : node run.ts [rewrite|triage|all]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "/Users/adriengrampone/Developer/perso/eclaircie/node_modules/zod/index.js";
import { draftOutputSchema } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/draft.ts";
import { buildVerifyPrompt, decideVerify, parseVerify, revisableProblems } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/verify.ts";
import { TriageSchema, isTriageAccepted, triageScore } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/triage.ts";
import { applyEditorialRules, mainTheme } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/editorial.ts";
import { parseJsonWith } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/json.ts";
import type { Article, Prompt } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/types.ts";
import { NEW_LENGTHS, buildImpactTriagePrompt, buildNewDraftPrompt, buildNewRevisePrompt, impactScore, IMPACT } from "./prompts.ts";

const HERE = "/private/tmp/claude-501/-Users-adriengrampone-Developer-perso-eclaircie/6302c657-def0-4dc3-8b5a-d56fa9c54d08/scratchpad/contenu";
const MODEL = "claude-haiku-5-5";
const PRICE = { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 }; // $ / million de tokens (Haiku 5.5, ≤ 100k)

const env = readFileSync("/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/.env", "utf8");
// Clé de l'environnement si fournie, sinon celle du .env local des Edge Functions (jamais affichée).
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || /^ANTHROPIC_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (!apiKey) throw new Error("clé absente");
const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 90_000 });

const rows = (file: string) => { const raw = readFileSync(`${HERE}/${file}`, "utf8"); return JSON.parse(raw.slice(raw.indexOf("{"))).rows; };
let cost = 0;
async function ask(prompt: Prompt, o: { maxTokens: number; thinking: boolean }): Promise<string> {
  const r = await client.messages.create({
    model: MODEL, max_tokens: o.maxTokens,
    thinking: o.thinking ? { type: "adaptive" } : { type: "disabled" },
    output_config: { effort: "low" },
    system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt.user }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const u = r.usage;
  cost += ((u.input_tokens ?? 0) * PRICE.input + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead
    + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (u.output_tokens ?? 0) * PRICE.output) / 1e6;
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}
async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i] as T, i); } }));
  return out;
}

/** Un appel dont la réponse JSON est validée ; une seconde tentative si le JSON est mal formé (comme un nouveau passage en prod). */
async function askParsed<T>(prompt: Prompt, parse: (t: string) => { ok: true; value: T } | { ok: false; error: string }): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let last: { ok: false; error: string } = { ok: false, error: "" };
  for (let i = 0; i < 2; i++) {
    const r = parse(await ask(prompt, { maxTokens: 4096, thinking: true }));
    if (r.ok) return r;
    last = r;
  }
  return last;
}

async function rewrite() {
  const stories = rows("vingt.json");
  const schema = draftOutputSchema({ summary_max_chars: 10_000, title_main_max_chars: 10_000, title_accent_max_chars: 10_000 });
  const parseDraft = (t: string) => parseJsonWith(schema, t);
  const results = await pool(stories, 5, async (s: Record<string, string | boolean | null>) => {
    const article: Article = { title: String(s.title), sourceName: String(s.source_name), url: String(s.url), publishedAt: (s.published_at as string) ?? null, fullText: String(s.full_text) };
    const base = { id: s.id, validee: s.validee, theme: s.theme_id, source: s.source_name, avant: { titre: `${s.title_main} ${s.title_accent ?? ""}`.trim(), resume: s.summary } };
    const d1 = await askParsed(buildNewDraftPrompt(article), parseDraft);
    if (!d1.ok) return { ...base, issue: "erreur", detail: `rédaction : ${d1.error.slice(0, 120)}` };
    if (d1.value.verdict === "not_good_news") return { ...base, issue: "refusée par le rédacteur", detail: d1.value.reason };
    let { verdict: _v, ...draft } = d1.value;
    const v1 = await askParsed(buildVerifyPrompt(article, draft), parseVerify);
    if (!v1.ok) return { ...base, issue: "erreur", detail: `vérification : ${v1.error.slice(0, 120)}`, apres: show(draft) };
    let dec = decideVerify(v1.value, draft, 1, { verify_max_passes: 2 });
    let passes = 1;
    const p1 = v1.value.problems.map((p) => `[${p.type}] ${p.passage} → ${p.correction}`);
    if (dec.decision === "revise") {
      const problems = revisableProblems(v1.value.problems);
      const r = await askParsed(buildNewRevisePrompt(article, draft, problems), parseDraft);
      if (!r.ok) return { ...base, issue: "erreur", detail: `révision : ${r.error.slice(0, 120)}`, apres: show(draft), problemes: p1 };
      if (r.value.verdict === "not_good_news") return { ...base, issue: "refusée à la révision", detail: r.value.reason, problemes: p1 };
      ({ verdict: _v, ...draft } = r.value);
      const v2 = await askParsed(buildVerifyPrompt(article, draft, { pass: 2, previousProblems: problems }), parseVerify);
      if (!v2.ok) return { ...base, issue: "erreur", detail: `vérification 2 : ${v2.error.slice(0, 120)}`, apres: show(draft), problemes: p1 };
      dec = decideVerify(v2.value, draft, 2, { verify_max_passes: 2 }, problems);
      passes = 2;
    }
    return { ...base, issue: dec.decision === "verified" ? "vérifiée" : "rejetée par le vérificateur", detail: dec.reason, passes, apres: show(draft), problemes: p1 };
  });
  writeFileSync(`${HERE}/reecriture.json`, JSON.stringify(results, null, 1));
  console.log(`réécriture : ${results.length} nouvelles, coût cumulé ${cost.toFixed(4)} $`);
}

function show(draft: { title_main: string; title_accent: string; summary: string }) {
  const titre = `${draft.title_main} ${draft.title_accent}`.trim();
  const over = [draft.title_main.length > NEW_LENGTHS.title_main_max_chars ? "titre" : "", draft.title_accent.length > NEW_LENGTHS.title_accent_max_chars ? "chute" : "", draft.summary.length > NEW_LENGTHS.summary_max_chars ? "résumé" : ""].filter(Boolean);
  return { titre, title_main: draft.title_main, title_accent: draft.title_accent, resume: draft.summary, mots_titre: titre.split(/\s+/).length, car_resume: draft.summary.length, depassements: over };
}

const ImpactSchema = z.object({
  concrete: z.number().min(0).max(1), accomplished: z.number().min(0).max(1), closeness: z.number().min(0).max(1),
  magnitude: z.number().min(0).max(1), before_after: z.number().min(0).max(1),
  preliminary: z.boolean().default(false), too_technical: z.boolean().default(false),
});

async function triage() {
  const articles = rows("tri2j.json");
  const themes = rows("themes.json").map((t: { id: string; label: string }) => ({ id: t.id, label: t.label }));
  const cfgRows = rows("config.json") as { key: string; value: unknown }[];
  const config = Object.fromEntries(cfgRows.map((r) => [r.key, r.value])) as { triage_weights: { positivity: number; significance: number; trust: number }; triage_min_score: number };
  const results = await pool(articles, 8, async (a: Record<string, unknown>) => {
    const reply = await ask(buildImpactTriagePrompt({ title: String(a.title), snippet: (a.snippet as string) ?? null, sourceName: String(a.source) }, themes), { maxTokens: 1024, thinking: false });
    const t = parseJsonWith(TriageSchema, reply);
    const imp = parseJsonWith(ImpactSchema, reply);
    const base = { id: a.id, titre: a.title, source: a.source, statut_actuel: a.status, rejet_actuel: a.reject_reason };
    if (!t.ok || !imp.ok) return { ...base, erreur: (t.ok ? "" : t.error) + (imp.ok ? "" : imp.error) };
    const edited = applyEditorialRules(t.value);
    const score = triageScore(edited.triage, Number(a.trust_level), config);
    const avant = edited.reason === null && isTriageAccepted(edited.triage, score, config);
    const theme = mainTheme(edited.triage);
    const impact = impactScore(imp.value, edited.triage.study_subject, theme);
    const final = Math.round((IMPACT.mix * impact + (1 - IMPACT.mix) * score) * 100) / 100;
    const apres = avant && impact >= IMPACT.min;
    return { ...base, theme, kind: edited.triage.kind, sujet: edited.triage.study_subject, score_actuel: Math.round(score * 100) / 100, impact, final, garde_avant: avant, garde_apres: apres, detail: imp.value, raison: edited.triage.reason };
  });
  writeFileSync(`${HERE}/tri.json`, JSON.stringify(results, null, 1));
  console.log(`tri : ${results.length} articles, coût cumulé ${cost.toFixed(4)} $`);
}

const what = process.argv[2] ?? "all";
if (what === "rewrite" || what === "all") await rewrite();
if (what === "triage" || what === "all") await triage();
console.log(`COÛT TOTAL ${cost.toFixed(4)} $`);
