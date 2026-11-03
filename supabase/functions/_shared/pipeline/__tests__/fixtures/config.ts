import { parseConfig, type ConfigRow, type PipelineConfig } from "../../config.ts";

/** Miroir exact des lignes insérées par la migration de seed. */
export const CONFIG_ROWS: ConfigRow[] = [
  { key: "collect_max_age_days", value: 7 },
  { key: "collect_max_age_days_trust3", value: 30 },
  { key: "triage_weights", value: { positivity: 0.35, significance: 0.35, trust: 0.3 } },
  { key: "triage_min_score", value: 0.65 },
  { key: "extract_min_chars", value: 800 },
  { key: "summary_max_chars", value: 350 },
  { key: "dedup_similarity", value: 0.88 },
  { key: "dedup_window_days", value: 90 },
  { key: "embedding_model", value: "voyage-3.5" },
  { key: "auto_approve_min_score", value: 0.8 },
  { key: "auto_approve_min_trust", value: 3 },
  { key: "schedule_horizon_days", value: 14 },
  { key: "schedule_recent_days", value: 10 },
  { key: "schedule_max_age_days", value: 30 },
  { key: "stock_alert_days", value: 7 },
  { key: "schedule_max_source_share", value: 0.3 },
  { key: "schedule_source_window_days", value: 14 },
  { key: "max_triage_per_day", value: 200 },
  { key: "max_draft_per_day", value: 40 },
  { key: "batch_size", value: 10 },
  { key: "verify_max_passes", value: 2 },
];

export function loadConfig(): PipelineConfig {
  const result = parseConfig(CONFIG_ROWS);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export const CONFIG: PipelineConfig = loadConfig();
