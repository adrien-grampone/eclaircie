/**
 * verify — §4.5. Pour chaque story `drafted` : contrôle EN CODE que chaque evidence
 * figure dans l'article (checkEvidence), puis second appel Sonnet, indépendant du
 * premier, qui classe chaque problème. La décision est prise en code (decideVerify) :
 * verified, to_revise (une seule fois) ou rejected. Chaque verdict est journalisé.
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { STORY_SELECT, draftOf, triageOf, type StoryRow, type VerifyLogEntry } from "../_shared/stories.ts";
import { checkEvidence } from "../_shared/pipeline/evidence.ts";
import { buildVerifyPrompt, decideVerify, parseVerify, resolveThemeMismatch, revisableProblems, type VerifyDecision } from "../_shared/pipeline/verify.ts";
import type { ThemeRef } from "../_shared/pipeline/types.ts";

interface ItemResult {
  id: string;
  title: string;
  pass: number;
  outcome: VerifyDecision | "failed";
  reason: string | null;
  /** Thème principal corrigé par verify (theme_mismatch autorisé). */
  theme_changed_to?: string;
}

const STEP = "verify";
const STATUS_OF: Record<VerifyDecision, string> = { verified: "verified", revise: "to_revise", rejected: "rejected" };

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const { data, error } = await db
      .from("stories").select(STORY_SELECT).eq("status", "drafted")
      .order("created_at", { ascending: true }).limit(config.batch_size);
    if (error) throw new Error(`stories : ${error.message}`);
    const stories = (data ?? []) as unknown as StoryRow[];
    const { data: themeRows, error: themeError } = await db.from("themes").select("id, label").eq("active", true).order("position");
    if (themeError) throw new Error(`themes : ${themeError.message}`);
    const themes = (themeRows ?? []) as ThemeRef[];

    const results = await mapLimit(stories, 3, async (story): Promise<ItemResult> => {
      const pass = story.verify_log.length + 1;
      const article = story.raw_articles;
      const settle = async (decision: VerifyDecision, reason: string | null, entry: VerifyLogEntry | null, theme?: string): Promise<ItemResult> => {
        const log = entry ? [...story.verify_log, entry] : story.verify_log;
        await db.from("stories")
          .update({
            status: STATUS_OF[decision], reject_reason: decision === "verified" ? null : reason?.slice(0, 1000) ?? null, verify_log: log,
            ...(theme ? { theme_id: theme } : {}),
          })
          .eq("id", story.id);
        return { id: story.id, title: story.title_main, pass, outcome: decision, reason, ...(theme ? { theme_changed_to: theme } : {}) };
      };
      if (!article) return settle("rejected", "verify_no_article", null);

      const draft = draftOf(story);
      const evidence = checkEvidence(draft.claims, article.full_text);
      if (!evidence.ok) {
        const missing = evidence.missing.map((c) => `« ${c.evidence.slice(0, 80)} »`).join(" ; ");
        return settle("rejected", `evidence_missing: ${evidence.missing.length}/${draft.claims.length} introuvable(s) : ${missing}`, null);
      }

      // Le thème n'est jamais soumis au rédacteur : il est corrigé (ou rejeté) en code.
      const previousProblems = revisableProblems(story.verify_log[story.verify_log.length - 1]?.verify.problems ?? []);
      try {
        const prompt = buildVerifyPrompt(
          { title: article.title, sourceName: story.source_name, url: story.source_url, publishedAt: article.published_at, fullText: article.full_text },
          draft,
          { pass, previousProblems, theme: { current: story.theme_id, available: themes } },
        );
        const reply = await askModel(MODELS.verify, prompt, { maxTokens: 4096, effort: "low", thinking: true });
        if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") {
          return settle("rejected", `verify_incomplete: ${reply.stopReason}`, null);
        }
        const parsed = parseVerify(reply.text);
        if (!parsed.ok) return settle("rejected", `verify_parse_error: ${parsed.error.slice(0, 200)}`, null);
        const at = new Date().toISOString();
        const theme = resolveThemeMismatch(parsed.value.problems, story.theme_id, triageOf(story), themes);
        if (theme.action === "reject") {
          return settle("rejected", theme.reason, { pass, model: MODELS.verify, decision: "rejected", reason: theme.reason, verify: parsed.value, at });
        }
        const { decision, reason } = decideVerify(parsed.value, draft, pass, config, previousProblems);
        const entry = { pass, model: MODELS.verify, decision, reason, verify: parsed.value, at };
        return settle(decision, reason, entry, theme.action === "change" ? theme.theme : undefined);
      } catch (cause) {
        const message = errorMessage(cause);
        console.error(`verify ${story.id} : ${message}`);
        return { id: story.id, title: story.title_main, pass, outcome: "failed", reason: `api_error: ${message}` };
      }
    });

    const count = (o: ItemResult["outcome"]) => results.filter((r) => r.outcome === o).length;
    await recordRun(db, {
      step: STEP, startedAt,
      processed: results.length - count("failed"), succeeded: count("verified"), failed: count("rejected"),
      error: count("failed") > 0 ? `${count("failed")} erreur(s) d'API` : null,
    });
    return json({ step: STEP, processed: results.length, verified: count("verified"), to_revise: count("revise"), rejected: count("rejected"), failed: count("failed"), results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
