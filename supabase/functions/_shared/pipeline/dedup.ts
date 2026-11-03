import type { PipelineConfig } from "./config.ts";

/**
 * Étape `dedup` (§4.6) — embedding de `title_main + summary`, comparé aux stories
 * des `dedup_window_days` derniers jours du même thème. Au-delà de
 * `dedup_similarity`, c'est le même événement : on garde celle dont la source a
 * le meilleur trust_level. La recherche vectorielle se fait en SQL ; ici, la décision.
 */

export interface DedupStory {
  id: string;
  trustLevel: number;
  status: string;
  /** timestamptz ISO ; à égalité de confiance, la plus ancienne gagne. */
  createdAt: string;
}

export interface Neighbour extends DedupStory {
  /** Similarité cosinus dans [0, 1]. */
  similarity: number;
}

export type DedupDecision =
  | { decision: "unique" }
  | { decision: "reject_story"; duplicateOf: string; similarity: number }
  | { decision: "keep_story"; rejectIds: string[] };

/** Statuts d'une story existante qu'une nouvelle venue mieux sourcée peut remplacer. */
const REPLACEABLE = new Set(["verified", "illustrated", "approved"]);

/** Texte dont on calcule l'embedding : titre complet puis résumé. */
export function embeddingInput(story: { title_main: string; title_accent: string | null; summary: string }): string {
  return `${story.title_main} ${story.title_accent ?? ""}`.trim() + "\n" + story.summary;
}

export function isDuplicate(similarity: number, config: Pick<PipelineConfig, "dedup_similarity">): boolean {
  return similarity >= config.dedup_similarity;
}

/**
 * - aucun voisin au-dessus du seuil → unique ;
 * - un voisin déjà programmé (ou mieux sourcé, ou aussi bien sourcé mais plus ancien) → la story est rejetée ;
 * - sinon la story gagne et les doublons remplaçables sont rejetés.
 */
export function resolveDuplicates(
  story: DedupStory,
  neighbours: readonly Neighbour[],
  config: Pick<PipelineConfig, "dedup_similarity">,
): DedupDecision {
  const duplicates = neighbours.filter((n) => isDuplicate(n.similarity, config));
  if (duplicates.length === 0) return { decision: "unique" };

  const beats = (a: DedupStory, b: DedupStory): boolean =>
    a.trustLevel > b.trustLevel || (a.trustLevel === b.trustLevel && a.createdAt < b.createdAt);

  const winner = duplicates.find((d) => !REPLACEABLE.has(d.status) || beats(d, story));
  if (winner) {
    const best = duplicates
      .filter((d) => !REPLACEABLE.has(d.status) || beats(d, story))
      .sort((a, b) => b.similarity - a.similarity)[0] ?? winner;
    return { decision: "reject_story", duplicateOf: best.id, similarity: best.similarity };
  }
  return { decision: "keep_story", rejectIds: duplicates.map((d) => d.id) };
}
