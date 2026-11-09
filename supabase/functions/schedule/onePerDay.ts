import type { serviceClient } from "../_shared/db.ts";
import { addDays } from "../_shared/pipeline/dates.ts";
import type { IsoDate } from "../_shared/pipeline/types.ts";
import type { PipelineConfig } from "../_shared/pipeline/config.ts";
import {
  isFresh, isReserveLow, pickFreshFirst, reserveSize, scheduleHorizon, upcomingToRelease,
  type ScheduleCandidate, type ScheduledStory, type UpcomingStory,
} from "../_shared/pipeline/schedule.ts";

/**
 * Stratégie `one_per_day` (mode perso) : UNE nouvelle par jour de l'horizon, choisie parmi tous les thèmes
 * suivis. Priorité stricte aux FRAÎCHES (rédigées depuis moins de schedule_fresh_hours) ; la réserve (nouvelles
 * validées non programmées) ne sert que si aucune fraîche n'est programmable. Une nouvelle de la réserve déjà
 * programmée sur un jour à venir (pas encore visible) cède sa place à une fraîche et retourne dans la réserve.
 * Entre candidates du même groupe : pickForSchedule (récente, puis intemporelle ; mêmes règles de source). En mode
 * auto-validation, seules les nouvelles validées (approved_at) sont candidates : l'app ne montre qu'elles.
 */
export interface OnePerDayResult {
  scheduled: { day: string; story_id: string; theme: string }[];
  released: string[];
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

  // Jours à venir tenus par une nouvelle de la réserve : rendus aux fraîches.
  const now = new Date();
  const freshCount = candidates.filter((c) => isFresh(c.createdAt, now, config)).length;
  const { data: upRows, error: upError } = await db
    .from("stories").select("id, publish_date, created_at, theme_id, source_name, source_date, evergreen, score")
    .in("theme_id", [...themeIds]).eq("status", "scheduled").gt("publish_date", today);
  if (upError) throw new Error(`stories à venir : ${upError.message}`);
  const upcoming = (upRows ?? []) as (Row & { publish_date: string })[];
  const released = freshCount === 0 ? [] : upcomingToRelease(
    upcoming.map((r): UpcomingStory => ({ id: r.id, publishDate: r.publish_date, createdAt: r.created_at })),
    freshCount, today, now, config,
  );
  if (released.length > 0) {
    const { error } = await db.from("stories").update({ status: config.schedule_input_status, publish_date: null })
      .in("id", released).eq("status", "scheduled");
    if (error) throw new Error(`déprogrammation : ${error.message}`);
    for (const r of upcoming.filter((u) => released.includes(u.id))) {
      themeOf.set(r.id, r.theme_id);
      candidates.push({ id: r.id, sourceName: r.source_name, sourceDate: r.source_date, createdAt: r.created_at, evergreen: r.evergreen, score: r.score });
    }
  }

  // Jours occupés : toute nouvelle programmée ou retirée d'un thème suivi.
  const { data: schedRows, error: schedError } = await db
    .from("stories").select("publish_date, source_name")
    .in("theme_id", [...themeIds]).in("status", ["scheduled", "retracted"])
    .gte("publish_date", addDays(today, -config.schedule_source_window_days));
  if (schedError) throw new Error(`stories programmées : ${schedError.message}`);
  const scheduled: ScheduledStory[] = ((schedRows ?? []) as { publish_date: string; source_name: string }[])
    .map((r) => ({ publishDate: r.publish_date, sourceName: r.source_name }));

  const result: OnePerDayResult = { scheduled: [], released, reserve: 0, reserve_low: false };
  const horizon = scheduleHorizon(today, config);
  for (const day of horizon) {
    const pick = pickFreshFirst(candidates, scheduled, day, now, config);
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
