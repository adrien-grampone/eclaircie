import type { PipelineConfig } from "./config.ts";
import { MAX_TRUST_LEVEL } from "./triage.ts";

type CollectConfig = Pick<PipelineConfig, "collect_max_age_days" | "collect_max_age_days_trust3">;

/** Fenêtre de collecte en jours : élargie pour les sources de confiance maximale (§4.1). */
export function collectMaxAgeDays(trustLevel: number, config: CollectConfig): number {
  return trustLevel >= MAX_TRUST_LEVEL ? config.collect_max_age_days_trust3 : config.collect_max_age_days;
}

/** Un article sans date est gardé ; sinon il doit dater de moins de `maxAgeDays`. */
export function isFreshEnough(publishedAt: string | null, maxAgeDays: number, now: Date): boolean {
  if (!publishedAt) return true;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return true;
  return now.getTime() - published <= maxAgeDays * 86_400_000;
}

/**
 * Un article `new` sorti de sa fenêtre de collecte (selon la confiance de sa source)
 * n'est plus trié : il passe en `expired` sans appel modèle. Sans date : jamais expiré.
 */
export function isExpired(
  article: { publishedAt: string | null; trustLevel: number },
  config: CollectConfig,
  now: Date,
): boolean {
  return !isFreshEnough(article.publishedAt, collectMaxAgeDays(article.trustLevel, config), now);
}
