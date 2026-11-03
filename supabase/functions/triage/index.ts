/**
 * triage — §4.2. Expire d'abord, sans appel modèle, les articles `new` sortis de leur
 * fenêtre de collecte. Puis prend batch_size articles `new`, les plus récents d'abord
 * (published_at desc, trust_level desc), demande à Claude Haiku le JSON de tri, calcule
 * le score, écrit `triaged` ou `rejected` article par article.
 * Garde-fou : s'arrête quand max_triage_per_day est atteint (compté via pipeline_runs).
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
import { isExpired } from "../_shared/pipeline/collect.ts";
import { applyEditorialRules } from "../_shared/pipeline/editorial.ts";
import {
  buildTriagePrompt,
  parseTriage,
  triageRejectReason,
  triageScore,
} from "../_shared/pipeline/triage.ts";
import type { ThemeRef } from "../_shared/pipeline/types.ts";

interface ArticleRow {
  id: string;
  title: string;
  snippet: string | null;
  status: string;
  triage: { themes?: string[]; kind?: string; score?: number } | null;
  source_name: string;
  trust_level: number;
}

interface ItemResult {
  id: string;
  title: string;
  outcome: "triaged" | "rejected" | "failed";
  reason: string | null;
  score: number | null;
  themes: string[] | null;
  kind: string | null;
  /** En mode re-triage : ce que disait le triage précédent. */
  previous: { themes: string[] | null; kind: string | null; score: number | null } | null;
}

/**
 * Corps optionnel : { "retriage": "extracted" } rejoue le triage sur les articles
 * d'un statut déjà passé (pour comparer après un changement de règles). Un article
 * re-trié et accepté garde son statut ; rejeté, il passe en `rejected`.
 * { "exclude_sources": ["ONU", "Climat"] } écarte les sources dont le nom contient
 * l'un de ces mots (test ciblé d'un lot). { "retriage": "triaged", "ids": [...] }
 * rejoue des articles précis, quel que soit leur triage précédent.
 */
interface Options {
  retriage: string | null;
  excludeSources: string[];
  ids: string[];
}

const STEP = "triage";

async function readOptions(req: Request): Promise<Options> {
  try {
    const body = (await req.json()) as { retriage?: unknown; exclude_sources?: unknown; ids?: unknown };
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { retriage: typeof body.retriage === "string" ? body.retriage : null, excludeSources: strings(body.exclude_sources), ids: strings(body.ids) };
  } catch {
    return { retriage: null, excludeSources: [], ids: [] };
  }
}

/**
 * Passe en `expired` les articles `new` sortis de leur fenêtre de collecte (isExpired,
 * selon la confiance de la source). Un seul lot de 1000 par invocation, sans appel modèle.
 */
async function expireStale(db: ReturnType<typeof serviceClient>, config: Awaited<ReturnType<typeof loadConfig>>): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() - config.collect_max_age_days * 86_400_000).toISOString();
  const { data, error } = await db
    .from("triage_queue").select("id, published_at, trust_level")
    .eq("status", "new").lt("published_at", horizon).limit(1000);
  if (error) throw new Error(`triage_queue : ${error.message}`);
  const rows = (data ?? []) as { id: string; published_at: string | null; trust_level: number }[];
  const ids = rows.filter((r) => isExpired({ publishedAt: r.published_at, trustLevel: r.trust_level }, config, now)).map((r) => r.id);
  if (ids.length === 0) return 0;
  const { error: updateError } = await db.from("raw_articles").update({ status: "expired" }).in("id", ids);
  if (updateError) throw new Error(`expiration : ${updateError.message}`);
  return ids.length;
}

Deno.serve(async (req) => {
  const options = await readOptions(req);
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const used = await processedToday(db, STEP);
    const batch = planBatch(config.max_triage_per_day, used, config.batch_size);
    if (batch === 0) {
      return json({ step: STEP, skipped: "budget journalier atteint", used, max: config.max_triage_per_day });
    }

    const expired = options.retriage ? 0 : await expireStale(db, config);

    const { data: themeRows, error: themeError } = await db
      .from("themes").select("id, label").eq("active", true).order("position");
    if (themeError) throw new Error(`themes : ${themeError.message}`);
    const themes = (themeRows ?? []) as ThemeRef[];

    let query = db
      .from("triage_queue")
      .select("id, title, snippet, status, triage, source_name, trust_level")
      .eq("status", options.retriage ?? "new");
    // En re-triage sans ids, on ne reprend que les articles triés avec l'ancien schéma (sans `kind`).
    if (options.ids.length > 0) query = query.in("id", options.ids);
    else if (options.retriage) query = query.is("triage->kind", null);
    for (const word of options.excludeSources) query = query.not("source_name", "ilike", `%${word}%`);
    const { data, error } = await query
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("trust_level", { ascending: false })
      .limit(batch);
    if (error) throw new Error(`raw_articles : ${error.message}`);
    const articles = (data ?? []) as unknown as ArticleRow[];

    const results = await mapLimit(articles, 5, async (article): Promise<ItemResult> => {
      const sourceName = article.source_name;
      const trustLevel = article.trust_level;
      const previous = options.retriage
        ? { themes: article.triage?.themes ?? null, kind: article.triage?.kind ?? null, score: article.triage?.score ?? null }
        : null;
      const base = { id: article.id, title: article.title, previous };
      try {
        const prompt = buildTriagePrompt({ title: article.title, snippet: article.snippet, sourceName }, themes);
        const reply = await askModel(MODELS.triage, prompt, { maxTokens: 1024, effort: "low", thinking: false });
        if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") {
          throw new Error(`réponse incomplète (${reply.stopReason})`);
        }
        const parsed = parseTriage(reply.text);
        if (!parsed.ok) {
          await db.from("raw_articles")
            .update({ status: "failed", reject_reason: "parse_error", triaged_at: new Date().toISOString(), triage: { raw: reply.text, error: parsed.error } })
            .eq("id", article.id);
          return { ...base, outcome: "failed", reason: "parse_error", score: null, themes: null, kind: null };
        }
        const ruled = applyEditorialRules(parsed.value);
        const score = triageScore(ruled.triage, trustLevel, config);
        const reason = ruled.reason ?? triageRejectReason(ruled.triage, score, config);
        const triage = { ...ruled.triage, score, trust_level: trustLevel, model: MODELS.triage };
        const keptStatus = options.retriage ? article.status : "triaged";
        await db.from("raw_articles")
          .update({ status: reason ? "rejected" : keptStatus, reject_reason: reason, triage, triaged_at: new Date().toISOString() })
          .eq("id", article.id);
        return { ...base, outcome: reason ? "rejected" : "triaged", reason, score, themes: ruled.triage.themes, kind: ruled.triage.kind };
      } catch (cause) {
        const message = errorMessage(cause);
        // On laisse l'article en `new` : il sera repris à la prochaine invocation.
        console.error(`triage ${article.id} : ${message}`);
        return { ...base, outcome: "failed", reason: `api_error: ${message}`, score: null, themes: null, kind: null };
      }
    });

    // `processed` = appels modèle ayant obtenu une réponse : c'est ce que le budget
    // journalier compte. Une erreur d'API (clé absente, réseau) ne consomme rien.
    const failed = results.filter((r) => r.outcome === "failed").length;
    const apiErrors = results.filter((r) => r.reason?.startsWith("api_error")).length;
    await recordRun(db, {
      step: STEP,
      startedAt,
      processed: results.length - apiErrors,
      succeeded: results.length - failed,
      failed,
      error: apiErrors > 0 ? `${apiErrors} erreur(s) d'API` : null,
    });
    return json({
      step: STEP,
      retriage: options.retriage,
      expired,
      budget: { used_before: used, max: config.max_triage_per_day },
      processed: results.length,
      triaged: results.filter((r) => r.outcome === "triaged").length,
      rejected: results.filter((r) => r.outcome === "rejected").length,
      failed,
      results,
    });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
