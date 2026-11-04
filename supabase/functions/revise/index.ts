/**
 * revise — §4.5 (boucle de révision). Pour chaque story `to_revise`, Sonnet réécrit
 * le brouillon avec les corrections du dernier verdict, sans fait nouveau. La story
 * repasse en `drafted` et sera re-vérifiée. Budget partagé avec draft (max_draft_per_day).
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { STORY_SELECT, draftOf, type StoryRow } from "../_shared/stories.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
import { buildRevisePrompt, decideDraftOutput, type ReviseOptions } from "../_shared/pipeline/draft.ts";
import { revisableProblems } from "../_shared/pipeline/verify.ts";

interface ItemResult {
  id: string;
  title: string;
  outcome: "revised" | "rejected" | "failed";
  reason: string | null;
}

const STEP = "revise";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const used = (await processedToday(db, "draft")) + (await processedToday(db, STEP));
    const batch = planBatch(config.max_draft_per_day, used, config.batch_size);
    if (batch === 0) return json({ step: STEP, skipped: "budget journalier atteint", used, max: config.max_draft_per_day });

    const { data, error } = await db
      .from("stories").select(STORY_SELECT).eq("status", "to_revise")
      .order("created_at", { ascending: true }).limit(batch);
    if (error) throw new Error(`stories : ${error.message}`);
    const stories = (data ?? []) as unknown as StoryRow[];

    const results = await mapLimit(stories, 3, async (story): Promise<ItemResult> => {
      const reject = async (reason: string): Promise<ItemResult> => {
        await db.from("stories").update({ status: "rejected", reject_reason: reason.slice(0, 1000) }).eq("id", story.id);
        return { id: story.id, title: story.title_main, outcome: "rejected", reason };
      };
      const article = story.raw_articles;
      const last = story.verify_log[story.verify_log.length - 1];
      if (!article || !last) return reject("revise_missing_context");
      try {
        const articleInput = { title: article.title, sourceName: story.source_name, url: story.source_url, publishedAt: article.published_at, fullText: article.full_text };
        let options: ReviseOptions = {};
        // Tentative 1, puis une de plus par revise_length_retries si seules des longueurs dépassent.
        for (let attempt = 1; ; attempt++) {
          const prompt = buildRevisePrompt(articleInput, draftOf(story), revisableProblems(last.verify.problems), config, options);
          const reply = await askModel(MODELS.draft, prompt, { maxTokens: 4096, effort: "low", thinking: true });
          if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") return reject(`revise_incomplete: ${reply.stopReason}`);
          const step = decideDraftOutput(reply.text, attempt, config, "revise");
          if (step.action === "retry_shorter") {
            options = { shorten: step.over };
            continue;
          }
          if (step.action === "reject") return reject(step.reason);
          if (step.action === "not_good_news") return reject(`revise_not_good_news: ${step.reason.slice(0, 300)}`);
          const d = step.draft;
          await db.from("stories")
            .update({ title_main: d.title_main, title_accent: d.title_accent || null, summary: d.summary, claims: d.claims, scene: d.scene, status: "drafted", reject_reason: null })
            .eq("id", story.id);
          return { id: story.id, title: d.title_main, outcome: "revised", reason: null };
        }
      } catch (cause) {
        const message = errorMessage(cause);
        console.error(`revise ${story.id} : ${message}`);
        return { id: story.id, title: story.title_main, outcome: "failed", reason: `api_error: ${message}` };
      }
    });

    const failed = results.filter((r) => r.outcome === "failed").length;
    const rejected = results.filter((r) => r.outcome === "rejected").length;
    await recordRun(db, { step: STEP, startedAt, processed: results.length - failed, succeeded: results.length - failed - rejected, failed: rejected, error: failed > 0 ? `${failed} erreur(s) d'API` : null });
    return json({ step: STEP, processed: results.length, revised: results.length - failed - rejected, rejected, failed, results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
