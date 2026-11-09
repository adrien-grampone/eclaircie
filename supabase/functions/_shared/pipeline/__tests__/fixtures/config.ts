import { parseConfig, type ConfigRow, type PipelineConfig } from "../../config.ts";

/** Miroir exact des lignes insérées par la migration de seed. */
export const CONFIG_ROWS: ConfigRow[] = [
  { key: "collect_max_age_days", value: 7 },
  { key: "collect_max_age_days_trust3", value: 30 },
  { key: "triage_weights", value: { positivity: 0.35, significance: 0.35, trust: 0.3 } },
  { key: "triage_min_score", value: 0.65 },
  { key: "triage_source_window_days", value: 7 },
  { key: "triage_source_prior_rate", value: 0.1 },
  { key: "triage_source_prior_weight", value: 10 },
  { key: "triage_source_review_min", value: 50 },
  { key: "extract_min_chars", value: 800 },
  { key: "summary_max_chars", value: 350 },
  { key: "title_main_max_chars", value: 32 },
  { key: "title_accent_max_chars", value: 28 },
  { key: "dedup_window_days", value: 30 },
  { key: "auto_approve_min_score", value: 0.8 },
  { key: "auto_approve_min_trust", value: 3 },
  { key: "schedule_horizon_days", value: 14 },
  { key: "schedule_recent_days", value: 10 },
  { key: "schedule_max_age_days", value: 30 },
  { key: "stock_alert_days", value: 7 },
  { key: "image_alert_days", value: 2 },
  { key: "schedule_max_source_share", value: 0.3 },
  { key: "schedule_source_window_days", value: 14 },
  { key: "schedule_input_status", value: "verified" },
  { key: "max_triage_per_day", value: 200 },
  { key: "max_draft_per_day", value: 40 },
  { key: "batch_size", value: 10 },
  { key: "verify_max_passes", value: 2 },
  { key: "revise_length_retries", value: 1 },
  { key: "impact_weights", value: { concrete: 0.25, accomplished: 0.25, closeness: 0.2, magnitude: 0.15, before_after: 0.15 } },
  { key: "impact_penalties", value: { non_human_study: 0.4, preliminary: 0.5, too_technical: 0.6 } },
  { key: "impact_mix", value: 0.5 },
  { key: "impact_min", value: 0.5 },
  { key: "followed_themes", value: null },
  { key: "unfollowed_exception", value: { min_accomplished: 0.7, fallback_theme: "sante" } },
  { key: "max_revise_per_day", value: 20 },
  { key: "max_rework_per_day", value: 50 },
  { key: "run_mode", value: "continuous" },
  { key: "auto_approve_verified", value: false },
  { key: "schedule_strategy", value: "per_theme" },
  { key: "reserve_min", value: 3 },
  { key: "schedule_fresh_hours", value: 24 },
];

export function loadConfig(): PipelineConfig {
  const result = parseConfig(CONFIG_ROWS);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export const CONFIG: PipelineConfig = loadConfig();
