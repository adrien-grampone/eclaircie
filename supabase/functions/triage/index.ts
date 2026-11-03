/**
 * triage — §4.2. Prend batch_size articles `new`, demande à Claude Haiku le JSON
 * de tri, calcule le score, écrit `triaged` ou `rejected` article par article.
 * Garde-fou : s'arrête quand max_triage_per_day est atteint (compté via pipeline_runs).
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
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
  sources: { name: string; trust_level: number } | null;
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
 */
interface Options {
  retriage: string | null;
}

const STEP = "triage";

async function readOptions(req: Request): Promise<Options> {
  try {
    const body = (await req.json()) as { retriage?: unknown };
    return { retriage: typeof body.retriage === "string" ? body.retriage : null };
  } catch {
    return { retriage: null };
  }
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

    const { data: themeRows, error: themeError } = await db
      .from("themes").select("id, label").eq("active", true).order("position");
    if (themeError) throw new Error(`themes : ${themeError.message}`);
    const themes = (themeRows ?? []) as ThemeRef[];

    let query = db
      .from("raw_articles")
      .select("id, title, snippet, status, triage, sources(name, trust_level)")
      .eq("status", options.retriage ?? "new");
    // En re-triage, on ne reprend que les articles triés avec l'ancien schéma (sans `kind`).
    if (options.retriage) query = query.is("triage->kind", null);
    const { data, error } = await query.order("fetched_at", { ascending: true }).limit(batch);
    if (error) throw new Error(`raw_articles : ${error.message}`);
    const articles = (data ?? []) as unknown as ArticleRow[];

    const results = await mapLimit(articles, 5, async (article): Promise<ItemResult> => {
      const sourceName = article.sources?.name ?? "source inconnue";
      const trustLevel = article.sources?.trust_level ?? 1;
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
            .update({ status: "failed", reject_reason: "parse_error", triage: { raw: reply.text, error: parsed.error } })
            .eq("id", article.id);
          return { ...base, outcome: "failed", reason: "parse_error", score: null, themes: null, kind: null };
        }
        const ruled = applyEditorialRules(parsed.value);
        const score = triageScore(ruled.triage, trustLevel, config);
        const reason = ruled.reason ?? triageRejectReason(ruled.triage, score, config);
        const triage = { ...ruled.triage, score, trust_level: trustLevel, model: MODELS.triage };
        const keptStatus = options.retriage ? article.status : "triaged";
        await db.from("raw_articles")
          .update({ status: reason ? "rejected" : keptStatus, reject_reason: reason, triage })
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
