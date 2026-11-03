/**
 * triage — §4.2. Prend batch_size articles `new`, demande à Claude Haiku le JSON
 * de tri, calcule le score, écrit `triaged` ou `rejected` article par article.
 * Garde-fou : s'arrête quand max_triage_per_day est atteint (compté via pipeline_runs).
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
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
  sources: { name: string; trust_level: number } | null;
}

interface ItemResult {
  id: string;
  outcome: "triaged" | "rejected" | "failed";
  reason: string | null;
  score: number | null;
}

const STEP = "triage";

Deno.serve(async () => {
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

    const { data, error } = await db
      .from("raw_articles")
      .select("id, title, snippet, sources(name, trust_level)")
      .eq("status", "new")
      .order("fetched_at", { ascending: true })
      .limit(batch);
    if (error) throw new Error(`raw_articles : ${error.message}`);
    const articles = (data ?? []) as unknown as ArticleRow[];

    const results = await mapLimit(articles, 5, async (article): Promise<ItemResult> => {
      const sourceName = article.sources?.name ?? "source inconnue";
      const trustLevel = article.sources?.trust_level ?? 1;
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
          return { id: article.id, outcome: "failed", reason: "parse_error", score: null };
        }
        const score = triageScore(parsed.value, trustLevel, config);
        const reason = triageRejectReason(parsed.value, score, config);
        const triage = { ...parsed.value, score, trust_level: trustLevel, model: MODELS.triage };
        await db.from("raw_articles")
          .update({ status: reason ? "rejected" : "triaged", reject_reason: reason, triage })
          .eq("id", article.id);
        return { id: article.id, outcome: reason ? "rejected" : "triaged", reason, score };
      } catch (cause) {
        const message = errorMessage(cause);
        // On laisse l'article en `new` : il sera repris à la prochaine invocation.
        console.error(`triage ${article.id} : ${message}`);
        return { id: article.id, outcome: "failed", reason: `api_error: ${message}`, score: null };
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
