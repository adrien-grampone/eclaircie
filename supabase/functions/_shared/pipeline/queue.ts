import type { PipelineConfig } from "./config.ts";

/**
 * File de triage (§4.2, rapport du 2026-11-04) : les articles `new` sont triés d'abord par
 * RENDEMENT de leur source (taux d'acceptation lissé sur une fenêtre, a priori pour une source
 * nouvelle), puis par date de publication décroissante. Budget de triage dépensé là où il rapporte.
 */
export interface SourceStats {
  source_id: string;
  triaged: number;
  accepted: number;
}

export interface QueueCandidate {
  id: string;
  source_id: string;
  published_at: string | null;
}

export type YieldConfig = Pick<PipelineConfig, "triage_source_prior_rate" | "triage_source_prior_weight">;

/**
 * Taux d'acceptation lissé : (acceptés + poids × a priori) / (triés + poids).
 * Une source sans historique vaut l'a priori ; une source très triée tend vers son taux réel.
 */
export function sourceYield(stats: Pick<SourceStats, "triaged" | "accepted">, config: YieldConfig): number {
  const { triage_source_prior_rate: prior, triage_source_prior_weight: weight } = config;
  const denominator = stats.triaged + weight;
  if (denominator <= 0) return prior;
  return (stats.accepted + weight * prior) / denominator;
}

/** Rendement de chaque source ; une source absente des statistiques vaut l'a priori. */
export function yieldBySource(stats: readonly SourceStats[], config: YieldConfig): Map<string, number> {
  return new Map(stats.map((s) => [s.source_id, sourceYield(s, config)]));
}

/** Ordre de la file : rendement décroissant, puis published_at décroissant (sans date en dernier), puis id. */
export function orderQueue<T extends QueueCandidate>(candidates: readonly T[], yields: ReadonlyMap<string, number>, config: YieldConfig): T[] {
  const fallback = config.triage_source_prior_rate;
  const rank = (c: T) => yields.get(c.source_id) ?? fallback;
  return [...candidates].sort((a, b) =>
    rank(b) - rank(a)
    || (b.published_at ?? "").localeCompare(a.published_at ?? "")
    || a.id.localeCompare(b.id),
  );
}

/** Sources « à revoir » dans le rapport du matin : beaucoup triées, rien d'accepté. Décision humaine. */
export function sourcesToReview(stats: readonly SourceStats[], config: Pick<PipelineConfig, "triage_source_review_min">): SourceStats[] {
  return stats.filter((s) => s.triaged >= config.triage_source_review_min && s.accepted === 0);
}
