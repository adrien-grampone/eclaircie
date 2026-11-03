/**
 * Garde-fou de coût : chaque fonction qui appelle un modèle compte ses traitements
 * du jour dans `pipeline_runs` et s'arrête au plafond fixé dans `pipeline_config`.
 */

/** Nombre d'éléments encore autorisés aujourd'hui, jamais négatif. */
export function remainingBudget(dailyMax: number, usedToday: number): number {
  return Math.max(0, dailyMax - usedToday);
}

/** Taille du lot à traiter : le plus petit entre la taille de lot et ce qui reste du budget. */
export function planBatch(dailyMax: number, usedToday: number, batchSize: number): number {
  return Math.max(0, Math.min(batchSize, remainingBudget(dailyMax, usedToday)));
}
