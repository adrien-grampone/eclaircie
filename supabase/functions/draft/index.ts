/**
 * draft — §4.4. Prend batch_size articles `extracted`, demande à Claude Sonnet le
 * brouillon JSON à partir du texte complet UNIQUEMENT, crée la story `drafted`.
 * Garde-fou : max_draft_per_day compté via pipeline_runs.
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
import { buildDraftPrompt, decideDraftOutput, type Draft, type DraftOptions } from "../_shared/pipeline/draft.ts";
import { mainTheme } from "../_shared/pipeline/editorial.ts";

interface ArticleRow {
  id: string;
  title: string;
  url: string;
  published_at: string | null;
  full_text: string;
  triage: { themes?: string[]; score?: number; evergreen?: boolean } | null;
  sources: { name: string } | null;
}

interface ItemResult {
  id: string;
  title: string;
  outcome: "drafted" | "not_good_news" | "failed";
  reason: string | null;
  story_id: string | null;
}

const STEP = "draft";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const used = await processedToday(db, STEP);
    const batch = planBatch(config.max_draft_per_day, used, config.batch_size);
    if (batch === 0) {
      return json({ step: STEP, skipped: "budget journalier atteint", used, max: config.max_draft_per_day });
    }

    const { data, error } = await db
      .from("raw_articles")
      .select("id, title, url, published_at, full_text, triage, sources(name)")
      .eq("status", "extracted")
      .order("fetched_at", { ascending: true })
      .limit(batch);
    if (error) throw new Error(`raw_articles : ${error.message}`);
    const articles = (data ?? []) as unknown as ArticleRow[];

    const fail = async (article: ArticleRow, reason: string): Promise<ItemResult> => {
      await db.from("raw_articles").update({ status: "failed", reject_reason: reason }).eq("id", article.id);
      return { id: article.id, title: article.title, outcome: "failed", reason, story_id: null };
    };

    const results = await mapLimit(articles, 3, async (article): Promise<ItemResult> => {
      const themeId = mainTheme({ themes: article.triage?.themes ?? [] });
      if (!themeId) return fail(article, "draft_no_theme");
      try {
        const articleInput = { title: article.title, sourceName: article.sources?.name ?? "source inconnue", url: article.url, publishedAt: article.published_at, fullText: article.full_text };
        let options: DraftOptions = {};
        let draft: Draft | null = null;
        // Tentative 1, puis une de plus par revise_length_retries si seules des longueurs dépassent.
        for (let attempt = 1; draft === null; attempt++) {
          const prompt = buildDraftPrompt(articleInput, config, options);
          const reply = await askModel(MODELS.draft, prompt, { maxTokens: 8192, effort: "low", thinking: true });
          if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") {
            return fail(article, `draft_incomplete: ${reply.stopReason}`);
          }
          const step = decideDraftOutput(reply.text, attempt, config, "draft");
          if (step.action === "retry_shorter") { options = { shorten: step.over }; continue; }
          if (step.action === "reject") return fail(article, step.reason.slice(0, 220));
          if (step.action === "not_good_news") {
            // Le rédacteur juge la contrepartie trop forte : pas de story, article rejeté.
            const reason = `draft_not_good_news: ${step.reason.slice(0, 300)}`;
            await db.from("raw_articles").update({ status: "rejected", reject_reason: reason }).eq("id", article.id);
            return { id: article.id, title: article.title, outcome: "not_good_news", reason, story_id: null };
          }
          draft = step.draft;
        }

        const { data: story, error: insertError } = await db
          .from("stories")
          .insert({
            raw_article_id: article.id,
            theme_id: themeId,
            title_main: draft.title_main,
            title_accent: draft.title_accent || null,
            summary: draft.summary,
            claims: draft.claims,
            scene: draft.scene,
            source_name: article.sources?.name ?? "source inconnue",
            source_url: article.url,
            source_date: article.published_at ? article.published_at.slice(0, 10) : null,
            score: article.triage?.score ?? 0,
            evergreen: article.triage?.evergreen ?? false,
            status: "drafted",
          })
          .select("id")
          .single();
        if (insertError) return fail(article, `draft_insert_error: ${insertError.message}`);
        await db.from("raw_articles").update({ status: "drafted" }).eq("id", article.id);
        return { id: article.id, title: article.title, outcome: "drafted", reason: null, story_id: (story as { id: string }).id };
      } catch (cause) {
        // Erreur d'API : l'article reste `extracted` et sera repris.
        const message = errorMessage(cause);
        console.error(`draft ${article.id} : ${message}`);
        return { id: article.id, title: article.title, outcome: "failed", reason: `api_error: ${message}`, story_id: null };
      }
    });

    const failed = results.filter((r) => r.outcome === "failed").length;
    const notGood = results.filter((r) => r.outcome === "not_good_news").length;
    const apiErrors = results.filter((r) => r.reason?.startsWith("api_error")).length;
    await recordRun(db, { step: STEP, startedAt, processed: results.length - apiErrors, succeeded: results.length - failed - notGood, failed, error: apiErrors > 0 ? `${apiErrors} erreur(s) d'API` : null });
    return json({ step: STEP, budget: { used_before: used, max: config.max_draft_per_day }, processed: results.length, drafted: results.length - failed - notGood, not_good_news: notGood, failed, results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
