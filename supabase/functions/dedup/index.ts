/**
 * dedup — §4.6 (sans embeddings). Pour chaque story `verified` non encore contrôlée :
 * Claude Haiku la compare aux stories retenues du même thème sur dedup_window_days
 * et désigne, le cas échéant, celle qui rapporte le même événement. Décision en code
 * (resolveDuplicate) : la source la mieux notée gagne, une story programmée n'est
 * jamais remplacée. Chaque story contrôlée reçoit dedup_checked_at.
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { MODELS, askModel } from "../_shared/claude.ts";
import { errorMessage, json, mapLimit } from "../_shared/http.ts";
import { buildDedupPrompt, matchedCandidate, parseDedup, resolveDuplicate, type DedupCard, type DedupStory } from "../_shared/pipeline/dedup.ts";

interface StoryRow {
  id: string;
  theme_id: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  source_name: string;
  source_date: string | null;
  status: string;
  created_at: string;
  raw_articles: { sources: { trust_level: number } | null } | null;
}

interface ItemResult {
  id: string;
  title: string;
  outcome: "unique" | "kept" | "rejected" | "failed";
  detail: string | null;
}

const STEP = "dedup";
const SELECT = "id, theme_id, title_main, title_accent, summary, source_name, source_date, status, created_at, raw_articles(sources(trust_level))";
const RETAINED = ["verified", "illustrated", "approved", "scheduled"];

const cardOf = (s: StoryRow): DedupCard => ({
  id: s.id, title: `${s.title_main} ${s.title_accent ?? ""}`.trim(), summary: s.summary, sourceName: s.source_name, sourceDate: s.source_date,
});
const storyOf = (s: StoryRow): DedupStory => ({
  id: s.id, trustLevel: s.raw_articles?.sources?.trust_level ?? 1, status: s.status, createdAt: s.created_at,
});

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const { data, error } = await db
      .from("stories").select(SELECT)
      .eq("status", "verified").is("dedup_checked_at", null)
      .order("created_at", { ascending: true }).limit(config.batch_size);
    if (error) throw new Error(`stories : ${error.message}`);
    const stories = (data ?? []) as unknown as StoryRow[];
    const since = new Date(Date.now() - config.dedup_window_days * 86_400_000).toISOString();

    const results = await mapLimit(stories, 3, async (story): Promise<ItemResult> => {
      try {
        const { data: rows, error: candError } = await db
          .from("stories").select(SELECT)
          .eq("theme_id", story.theme_id).in("status", RETAINED).neq("id", story.id).gte("created_at", since)
          .order("created_at", { ascending: false }).limit(50);
        if (candError) throw new Error(`candidates : ${candError.message}`);
        const candidates = (rows ?? []) as unknown as StoryRow[];

        let duplicate: StoryRow | null = null;
        let reason = "aucune candidate";
        if (candidates.length > 0) {
          const prompt = buildDedupPrompt(cardOf(story), candidates.map(cardOf), config);
          const reply = await askModel(MODELS.dedup, prompt, { maxTokens: 512, effort: "low", thinking: false });
          if (reply.stopReason === "refusal" || reply.stopReason === "max_tokens") throw new Error(`réponse incomplète (${reply.stopReason})`);
          const parsed = parseDedup(reply.text);
          if (!parsed.ok) throw new Error(`parse_error: ${parsed.error.slice(0, 200)}`);
          reason = parsed.value.reason;
          duplicate = matchedCandidate(parsed.value, candidates);
          if (parsed.value.duplicate_of !== null && !duplicate) reason = `identifiant inconnu ignoré : ${reason}`;
        }

        const decision = resolveDuplicate(storyOf(story), duplicate ? storyOf(duplicate) : null);
        const checked = { dedup_checked_at: new Date().toISOString() };
        if (decision.decision === "reject_story") {
          await db.from("stories").update({ ...checked, status: "rejected", reject_reason: `duplicate_of: ${decision.duplicateOf} — ${reason}`.slice(0, 1000) }).eq("id", story.id);
          return { id: story.id, title: story.title_main, outcome: "rejected", detail: `doublon de ${decision.duplicateOf} : ${reason}` };
        }
        if (decision.decision === "keep_story") {
          await db.from("stories").update({ status: "rejected", reject_reason: `duplicate_of: ${story.id} (remplacée par une source mieux notée) — ${reason}`.slice(0, 1000) }).in("id", decision.rejectIds);
          await db.from("stories").update(checked).eq("id", story.id);
          return { id: story.id, title: story.title_main, outcome: "kept", detail: `remplace ${decision.rejectIds.join(", ")} : ${reason}` };
        }
        await db.from("stories").update(checked).eq("id", story.id);
        return { id: story.id, title: story.title_main, outcome: "unique", detail: reason };
      } catch (cause) {
        // Erreur d'API : la story reste à contrôler et sera reprise.
        return { id: story.id, title: story.title_main, outcome: "failed", detail: errorMessage(cause) };
      }
    });

    const count = (o: ItemResult["outcome"]) => results.filter((r) => r.outcome === o).length;
    await recordRun(db, { step: STEP, startedAt, processed: results.length - count("failed"), succeeded: count("unique") + count("kept"), failed: count("rejected"), error: count("failed") > 0 ? `${count("failed")} erreur(s)` : null });
    return json({ step: STEP, processed: results.length, unique: count("unique"), kept: count("kept"), rejected: count("rejected"), failed: count("failed"), results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
