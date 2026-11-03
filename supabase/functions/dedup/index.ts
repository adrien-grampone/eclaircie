/**
 * dedup — §4.6. Pour chaque story `verified` sans embedding : embedding de
 * titre + résumé, recherche des voisines du même thème sur dedup_window_days
 * (match_stories, SQL), décision en code (resolveDuplicates). Une story unique
 * ou gagnante garde son statut avec son embedding ; une perdante passe en `rejected`.
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { embedTexts } from "../_shared/embeddings.ts";
import { errorMessage, json } from "../_shared/http.ts";
import { embeddingInput, resolveDuplicates, type Neighbour } from "../_shared/pipeline/dedup.ts";

interface StoryRow {
  id: string;
  theme_id: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  status: string;
  created_at: string;
  raw_articles: { sources: { trust_level: number } | null } | null;
}

interface MatchRow {
  id: string;
  similarity: number;
  status: string;
  trust_level: number;
  created_at: string;
}

interface ItemResult {
  id: string;
  title: string;
  outcome: "unique" | "kept" | "rejected" | "failed";
  detail: string | null;
}

const STEP = "dedup";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const { data, error } = await db
      .from("stories")
      .select("id, theme_id, title_main, title_accent, summary, status, created_at, raw_articles(sources(trust_level))")
      .eq("status", "verified").is("embedding", null)
      .order("created_at", { ascending: true }).limit(config.batch_size);
    if (error) throw new Error(`stories : ${error.message}`);
    const stories = (data ?? []) as unknown as StoryRow[];
    if (stories.length === 0) return json({ step: STEP, processed: 0, results: [] });

    // Un seul appel d'embeddings pour tout le lot.
    const vectors = await embedTexts(stories.map(embeddingInput), config.embedding_model);
    const since = new Date(Date.now() - config.dedup_window_days * 86_400_000).toISOString();

    const results: ItemResult[] = [];
    for (const [i, story] of stories.entries()) {
      const embedding = vectors[i];
      if (!embedding) continue;
      try {
        const { data: matches, error: matchError } = await db.rpc("match_stories", {
          query_embedding: JSON.stringify(embedding), p_theme_id: story.theme_id, p_since: since,
          p_min_similarity: config.dedup_similarity, p_exclude: story.id,
        });
        if (matchError) throw new Error(`match_stories : ${matchError.message}`);
        const neighbours: Neighbour[] = ((matches ?? []) as MatchRow[]).map((m) => ({
          id: m.id, similarity: m.similarity, status: m.status, trustLevel: m.trust_level, createdAt: m.created_at,
        }));
        const self = { id: story.id, trustLevel: story.raw_articles?.sources?.trust_level ?? 1, status: story.status, createdAt: story.created_at };
        const decision = resolveDuplicates(self, neighbours, config);

        await db.from("stories").update({ embedding: JSON.stringify(embedding) }).eq("id", story.id);
        if (decision.decision === "reject_story") {
          await db.from("stories").update({ status: "rejected", reject_reason: `duplicate_of: ${decision.duplicateOf} (${decision.similarity.toFixed(3)})` }).eq("id", story.id);
          results.push({ id: story.id, title: story.title_main, outcome: "rejected", detail: `doublon de ${decision.duplicateOf}` });
        } else if (decision.decision === "keep_story") {
          await db.from("stories").update({ status: "rejected", reject_reason: `duplicate_of: ${story.id} (remplacée par une source mieux notée)` }).in("id", decision.rejectIds);
          results.push({ id: story.id, title: story.title_main, outcome: "kept", detail: `remplace ${decision.rejectIds.join(", ")}` });
        } else {
          results.push({ id: story.id, title: story.title_main, outcome: "unique", detail: null });
        }
      } catch (cause) {
        results.push({ id: story.id, title: story.title_main, outcome: "failed", detail: errorMessage(cause) });
      }
    }

    const failed = results.filter((r) => r.outcome === "failed").length;
    await recordRun(db, { step: STEP, startedAt, processed: results.length - failed, succeeded: results.filter((r) => r.outcome !== "rejected" && r.outcome !== "failed").length, failed: results.filter((r) => r.outcome === "rejected").length, error: failed > 0 ? `${failed} erreur(s)` : null });
    return json({ step: STEP, processed: results.length, unique: results.filter((r) => r.outcome === "unique").length, kept: results.filter((r) => r.outcome === "kept").length, rejected: results.filter((r) => r.outcome === "rejected").length, failed, results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
