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
  /** §4.2 — score minimal pour passer le tri (sur le score final, mélange avec l'impact). */
  triage_min_score: z.number().min(0).max(1),
  /** Score d'impact (test du 2026-11-09) — pondérations des cinq critères notés par le modèle. */
  impact_weights: z.object({
    concrete: z.number().min(0),
    accomplished: z.number().min(0),
    closeness: z.number().min(0),
    magnitude: z.number().min(0),
    before_after: z.number().min(0),
  }),
  /** Multiplicateurs appliqués à l'impact : étude animale ou in vitro hors Animaux, résultat préliminaire, sujet trop technique. */
  impact_penalties: z.object({
    non_human_study: z.number().min(0).max(1),
    preliminary: z.number().min(0).max(1),
    too_technical: z.number().min(0).max(1),
  }),
  /** Score final = impact_mix × impact + (1 − impact_mix) × score de tri. */
  impact_mix: z.number().min(0).max(1),
  /** Impact minimal, quel que soit le score final. */
  impact_min: z.number().min(0).max(1),
  /**
   * Thèmes suivis (null = tous). Hors de cette liste : sources non collectées, articles rejetés au tri
   * (sauf exception ci-dessous), rien n'est programmé. Appliqué aussi à `themes.followed` (app).
   */
  followed_themes: z.array(z.string().min(1)).nullable(),
  /**
   * Exception aux thèmes suivis : une percée ou une invention d'un thème non suivi passe si elle a DÉJÀ
   * un effet concret sur des gens (étude humaine ou hors étude, non préliminaire, `accomplished` au moins
   * égal à ce seuil). Elle est rangée dans le thème suivi le plus proche, sinon `fallback_theme`.
   */
  unfollowed_exception: z.object({
    min_accomplished: z.number().min(0).max(1),
    fallback_theme: z.string().min(1),
  }),
  /** File de triage — fenêtre du taux d'acceptation par source, en jours. */
  triage_source_window_days: z.number().int().positive(),
  /** File de triage — taux supposé d'une source sans historique (a priori). */
  triage_source_prior_rate: z.number().min(0).max(1),
  /** File de triage — poids de cet a priori, en articles équivalents. */
  triage_source_prior_weight: z.number().min(0),
  /** Rapport du matin — « source à revoir » : au moins N triés sur la fenêtre et aucun accepté. */
  triage_source_review_min: z.number().int().positive(),
  /** §4.3 — texte complet minimal, sinon `no_fulltext`. */
  extract_min_chars: z.number().int().positive(),
  /** §4.4 — longueur maximale du résumé. */
  summary_max_chars: z.number().int().positive(),
  /** §4.4 — longueur maximale du titre (title_main), pour tenir en 3 lignes dans l'app. */
  title_main_max_chars: z.number().int().positive(),
  /** §4.4 — longueur maximale de la chute (title_accent). */
  title_accent_max_chars: z.number().int().positive(),
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
  /** Garde-fou de coût — rédactions (draft) par jour. Posé par le mode de fonctionnement (apply_run_mode). */
  max_draft_per_day: z.number().int().min(0),
  /** Garde-fou de coût — révisions (revise) par jour, comptées à part des rédactions. */
  max_revise_per_day: z.number().int().min(0),
  /** Garde-fou de coût — reprises d'anciennes nouvelles (to_rework) et révisions qui en découlent, par jour. */
  max_rework_per_day: z.number().int().min(0),
  /** Mode de fonctionnement (voir apply_run_mode) : continu, ou un passage par jour. */
  run_mode: z.enum(["continuous", "daily_window"]),
  /** Toute nouvelle vérifiée est validée d'office (approved_at), sans passage par /review. Posé par le mode. */
  auto_approve_verified: z.boolean(),
  /** Programmation : `per_theme` (un jour par thème) ou `one_per_day` (une nouvelle par jour, tous thèmes suivis). */
  schedule_strategy: z.enum(["per_theme", "one_per_day"]),
  /** Réserve (one_per_day) : alerte quand moins de N nouvelles validées restent programmables. */
  reserve_min: z.number().int().min(0),
  /**
   * Fraîcheur (one_per_day) : une nouvelle créée depuis moins de N heures passe avant la réserve, et prend la place
   * d'une nouvelle de la réserve déjà programmée sur un jour à venir (pas encore visible).
   */
  schedule_fresh_hours: z.number().positive(),
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
