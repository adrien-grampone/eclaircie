/**
 * revise — §4.5 (boucle de révision). Pour chaque story `to_revise`, le modèle réécrit le brouillon avec les
 * corrections du dernier verdict, sans fait nouveau. Pour chaque story `to_rework` (ancienne nouvelle reprise),
 * il le réécrit selon la consigne actuelle. Dans les deux cas, la story repasse en `drafted` et sera re-vérifiée.
 * Budgets : max_revise_per_day pour les révisions ordinaires (étape `revise`), max_rework_per_day pour les
 * reprises et les révisions qui en découlent (étape `rework`). Les rédactions ne les consomment pas.
 */
import { loadConfig, processedToday, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { STORY_SELECT, draftOf, isRework, type StoryRow } from "../_shared/stories.ts";
import { planBatch } from "../_shared/pipeline/budget.ts";
import { buildReworkPrompt, buildRevisePrompt, decideDraftOutput, type ReviseOptions } from "../_shared/pipeline/draft.ts";
import { revisableProblems } from "../_shared/pipeline/verify.ts";

interface ItemResult {
  id: string;
  title: string;
  kind: "revise" | "rework";
  outcome: "revised" | "rejected" | "failed";
  reason: string | null;
}

const STEP = "revise";
/** Étape comptée à part pour le budget des reprises (max_rework_per_day). */
const REWORK_STEP = "rework";

/** Stories en attente, la file la plus ancienne d'abord, réparties entre révision ordinaire et reprise. */
const QUEUE_SCAN = 200;

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const usedRevise = await processedToday(db, STEP);
    const usedRework = await processedToday(db, REWORK_STEP);
    const reviseBatch = planBatch(config.max_revise_per_day, usedRevise, config.batch_size);
    const reworkBatch = planBatch(config.max_rework_per_day, usedRework, config.batch_size);
    if (reviseBatch === 0 && reworkBatch === 0) {
      return json({ step: STEP, skipped: "budget journalier atteint", used: { revise: usedRevise, rework: usedRework } });
    }

    const { data, error } = await db
      .from("stories").select(STORY_SELECT).in("status", ["to_revise", "to_rework"])
      .order("created_at", { ascending: true }).limit(QUEUE_SCAN);
    if (error) throw new Error(`stories : ${error.message}`);
    const queued = (data ?? []) as unknown as StoryRow[];
    const stories = [
      ...queued.filter((s) => !isRework(s)).slice(0, reviseBatch),
      ...queued.filter(isRework).slice(0, reworkBatch),
    ];

    const results = await mapLimit(stories, 3, async (story): Promise<ItemResult> => {
      const reject = async (reason: string): Promise<ItemResult> => {
        await db.from("stories").update({ status: "rejected", reject_reason: reason.slice(0, 1000) }).eq("id", story.id);
        return { id: story.id, kind: isRework(story) ? "rework" : "revise", title: story.title_main, outcome: "rejected", reason };
      };
      const article = story.raw_articles;
      const last = story.verify_log[story.verify_log.length - 1];
      const rework = story.status === "to_rework";
      if (!article || (!rework && !last)) return reject("revise_missing_context");
      try {
        const articleInput = { title: article.title, sourceName: story.source_name, url: story.source_url, publishedAt: article.published_at, fullText: article.full_text };
        let options: ReviseOptions = {};
        // Tentative 1, puis une de plus par revise_length_retries si seules des longueurs dépassent.
        for (let attempt = 1; ; attempt++) {
          const prompt = rework || !last
            ? buildReworkPrompt(articleInput, draftOf(story), config, options)
            : buildRevisePrompt(articleInput, draftOf(story), revisableProblems(last.verify.problems), config, options);
          const reply = await askModel(MODELS.draft, prompt, { maxTokens: 8192, effort: "low", thinking: true });
          if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") return reject(`revise_incomplete: ${reply.stopReason}`);
          const step = decideDraftOutput(reply.text, attempt, config, rework ? "rework" : "revise");
          if (step.action === "retry_shorter") {
            options = { shorten: step.over };
            continue;
          }
          if (step.action === "reject") return reject(step.reason);
          if (step.action === "not_good_news") return reject(`${rework ? "rework" : "revise"}_not_good_news: ${step.reason.slice(0, 300)}`);
          const d = step.draft;
          await db.from("stories")
            .update({ title_main: d.title_main, title_accent: d.title_accent || null, summary: d.summary, claims: d.claims, scene: d.scene, status: "drafted", reject_reason: null })
            .eq("id", story.id);
          return { id: story.id, kind: isRework(story) ? "rework" : "revise", title: d.title_main, outcome: "revised", reason: null };
        }
      } catch (cause) {
        const message = errorMessage(cause);
        console.error(`revise ${story.id} : ${message}`);
        return { id: story.id, kind: isRework(story) ? "rework" : "revise", title: story.title_main, outcome: "failed", reason: `api_error: ${message}` };
      }
    });

    // Un run par budget : `processed` (appels ayant obtenu une réponse) est ce que processedToday compte.
    const summary = (kind: "revise" | "rework") => {
      const part = results.filter((r) => r.kind === kind);
      const failed = part.filter((r) => r.outcome === "failed").length;
      const rejected = part.filter((r) => r.outcome === "rejected").length;
      return { processed: part.length - failed, succeeded: part.length - failed - rejected, failed: rejected, error: failed > 0 ? `${failed} erreur(s) d'API` : null };
    };
    await recordRun(db, { step: STEP, startedAt, ...summary("revise") });
    if (results.some((r) => r.kind === "rework")) await recordRun(db, { step: REWORK_STEP, startedAt, ...summary("rework") });
    return json({ step: STEP, revise: summary("revise"), rework: summary("rework"), results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
