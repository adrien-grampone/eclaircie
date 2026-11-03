import { z } from "zod";
import type { ParseResult } from "./types.ts";
import { formatIssues } from "./json.ts";

/**
 * Seuils du pipeline, lus dans la table `pipeline_config` (une ligne par clé).
 * Aucune valeur par défaut ici : une clé manquante est une erreur, pas un seuil
 * caché dans le code. Les valeurs initiales sont posées par la migration de seed.
 */
export const PipelineConfigSchema = z.object({
  /** §4.1 — articles plus vieux que N jours ignorés à la collecte. */
  collect_max_age_days: z.number().int().positive(),
  /** §4.1 — fenêtre élargie pour les sources trust_level 3 (institutions, revues). */
  collect_max_age_days_trust3: z.number().int().positive(),
  /** §4.2 — pondérations du score de tri. */
  triage_weights: z.object({
    positivity: z.number().min(0),
    significance: z.number().min(0),
    trust: z.number().min(0),
  }),
  /** §4.2 — score minimal pour passer le tri. */
  triage_min_score: z.number().min(0).max(1),
  /** §4.3 — texte complet minimal, sinon `no_fulltext`. */
  extract_min_chars: z.number().int().positive(),
  /** §4.4 — longueur maximale du résumé. */
  summary_max_chars: z.number().int().positive(),
  /** §4.6 — fenêtre de comparaison des doublons, en jours. */
  dedup_window_days: z.number().int().positive(),
  /** §4.8 — auto-validation : score minimal… */
  auto_approve_min_score: z.number().min(0).max(1),
  /** §4.8 — …et trust_level minimal de la source. */
  auto_approve_min_trust: z.number().int().min(1).max(3),
  /**
   * §4.9 — statut d'entrée de schedule. `approved` quand illustrate et review
   * existent ; `verified` tant qu'ils n'existent pas (décision du 2026-11-03).
   */
  schedule_input_status: z.enum(["verified", "illustrated", "approved"]),
  /** §4.9 — nombre de jours à programmer d'avance. */
  schedule_horizon_days: z.number().int().positive(),
  /** §4.9 — une story est « récente » en dessous de N jours. */
  schedule_recent_days: z.number().int().positive(),
  /** §4.9 — une story non intemporelle de plus de N jours n'est plus programmable. */
  schedule_max_age_days: z.number().int().positive(),
  /** §4.9 — alerte si le stock programmé d'un thème descend sous N jours. */
  stock_alert_days: z.number().int().positive(),
  /** Illustrations à la main — alerte `image_missing` quand une story programmée dans moins de N jours n'a pas d'image. */
  image_alert_days: z.number().int().min(0),
  /** §4.9 — part maximale d'une même source parmi les nouvelles d'un thème… */
  schedule_max_source_share: z.number().min(0).max(1),
  /** …sur cette fenêtre glissante, en jours. */
  schedule_source_window_days: z.number().int().positive(),
  /** Garde-fou de coût — appels Haiku (triage) par jour, toutes invocations confondues. */
  max_triage_per_day: z.number().int().min(0),
  /** Garde-fou de coût — appels Sonnet (draft) par jour. */
  max_draft_per_day: z.number().int().min(0),
  /** Éléments traités par invocation d'une Edge Function. */
  batch_size: z.number().int().positive(),
  /** §4.5 — passes de vérification maximales (draft → verify → revise → verify = 2). */
  verify_max_passes: z.number().int().positive(),
  /** §4.5 — tentatives supplémentaires de révision quand seul le résumé est trop long. */
  revise_length_retries: z.number().int().min(0),
});

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

/** Une ligne de `pipeline_config` telle que renvoyée par Supabase. */
export interface ConfigRow {
  key: string;
  value: unknown;
}

/** Assemble les lignes clé/valeur en un objet de configuration validé. */
export function parseConfig(rows: readonly ConfigRow[]): ParseResult<PipelineConfig> {
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  const result = PipelineConfigSchema.safeParse(merged);
  if (!result.success) {
    return { ok: false, error: `pipeline_config invalide : ${formatIssues(result.error)}` };
  }
  return { ok: true, value: result.data };
}
