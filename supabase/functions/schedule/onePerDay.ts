import type { serviceClient } from "../_shared/db.ts";
import { addDays } from "../_shared/pipeline/dates.ts";
import type { IsoDate } from "../_shared/pipeline/types.ts";
import type { PipelineConfig } from "../_shared/pipeline/config.ts";
import {
  isReserveLow, pickForSchedule, reserveSize, scheduleHorizon,
  type ScheduleCandidate, type ScheduledStory,
} from "../_shared/pipeline/schedule.ts";

/**
 * Stratégie `one_per_day` (mode perso) : UNE nouvelle par jour de l'horizon, choisie parmi tous les thèmes
 * suivis par pickForSchedule (récente d'abord, puis intemporelle ; mêmes règles de source). Les nouvelles
 * validées non programmées forment la réserve, où l'on pioche quand rien de récent n'est prêt. En mode
 * auto-validation, seules les nouvelles validées (approved_at) sont candidates : l'app ne montre qu'elles.
 */
export interface OnePerDayResult {
  scheduled: { day: string; story_id: string; theme: string }[];
  reserve: number;
  reserve_low: boolean;
}

interface Row {
  id: string;
  theme_id: string;
  source_name: string;
  source_date: string | null;
  created_at: string;
  evergreen: boolean;
  score: number;
}

export async function scheduleOnePerDay(
  db: ReturnType<typeof serviceClient>,
  themeIds: readonly string[],
  today: IsoDate,
  config: PipelineConfig,
): Promise<OnePerDayResult> {
  let query = db.from("stories").select("id, theme_id, source_name, source_date, created_at, evergreen, score")
    .in("theme_id", [...themeIds]).eq("status", config.schedule_input_status).is("publish_date", null);
  if (config.auto_approve_verified) query = query.not("approved_at", "is", null);
  const { data: candRows, error: candError } = await query;
  if (candError) throw new Error(`stories (réserve) : ${candError.message}`);
  const themeOf = new Map<string, string>();
  let candidates: ScheduleCandidate[] = ((candRows ?? []) as Row[]).map((r) => {
    themeOf.set(r.id, r.theme_id);
    return { id: r.id, sourceName: r.source_name, sourceDate: r.source_date, createdAt: r.created_at, evergreen: r.evergreen, score: r.score };
  });

  // Jours occupés : toute nouvelle programmée ou retirée d'un thème suivi.
  const { data: schedRows, error: schedError } = await db
    .from("stories").select("publish_date, source_name")
    .in("theme_id", [...themeIds]).in("status", ["scheduled", "retracted"])
    .gte("publish_date", addDays(today, -config.schedule_source_window_days));
  if (schedError) throw new Error(`stories programmées : ${schedError.message}`);
  const scheduled: ScheduledStory[] = ((schedRows ?? []) as { publish_date: string; source_name: string }[])
    .map((r) => ({ publishDate: r.publish_date, sourceName: r.source_name }));

  const result: OnePerDayResult = { scheduled: [], reserve: 0, reserve_low: false };
  const horizon = scheduleHorizon(today, config);
  for (const day of horizon) {
    const pick = pickForSchedule(candidates, scheduled, day, config);
    if (!pick) continue;
    const { error } = await db.from("stories").update({ status: "scheduled", publish_date: day }).eq("id", pick.id);
    if (error) throw new Error(`programmation ${pick.id} : ${error.message}`);
    scheduled.push({ publishDate: day, sourceName: pick.sourceName });
    candidates = candidates.filter((c) => c.id !== pick.id);
    result.scheduled.push({ day, story_id: pick.id, theme: themeOf.get(pick.id) ?? "" });
  }

  const after = addDays(horizon[horizon.length - 1] ?? today, 1);
  result.reserve = reserveSize(candidates, after, config);
  result.reserve_low = isReserveLow(result.reserve, config);
  const { error: alertError } = result.reserve_low
    ? await db.rpc("raise_pipeline_alert", {
      p_kind: "stock_low", p_fingerprint: "stock:reserve", p_theme_id: null,
      p_message: `réserve : ${result.reserve} nouvelle(s) validée(s) programmable(s), seuil ${config.reserve_min}`,
      p_details: { reserve: result.reserve, today },
    })
    : await db.rpc("resolve_pipeline_alert", { p_fingerprint: "stock:reserve" });
  if (alertError) throw new Error(`pipeline_alerts (réserve) : ${alertError.message}`);
  return result;
}
