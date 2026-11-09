/**
 * schedule — §4.9. Stratégie `one_per_day` (mode perso) : voir onePerDay.ts. Sinon, pour chaque thème suivi et chaque jour de l'horizon sans nouvelle,
 * programme la meilleure story au statut `schedule_input_status` (pickForSchedule,
 * décision en code). Seules les stories sans publish_date sont candidates et seuls les jours libres
 * d'aujourd'hui à l'horizon sont remplis : une story programmée ne l'est jamais deux fois, le passé
 * n'est jamais touché. Puis mesure le stock programmé du thème et ouvre ou résout
 * l'alerte `stock_low` dans pipeline_alerts. Enfin, ouvre ou résout les alertes `image_missing`
 * des stories programmées à J-2 sans illustration (faites à la main dans le back-office).
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { errorMessage, json } from "../_shared/http.ts";
import { checkImageAlerts } from "./images.ts";
import { scheduleOnePerDay } from "./onePerDay.ts";
import { addDays, toIsoDate } from "../_shared/pipeline/dates.ts";
import {
  isStockLow, pickForSchedule, scheduleHorizon, stockDays,
  type ScheduleCandidate, type ScheduledStory,
} from "../_shared/pipeline/schedule.ts";

interface CandidateRow {
  id: string;
  source_name: string;
  source_date: string | null;
  created_at: string;
  evergreen: boolean;
  score: number;
}

interface ScheduledRow {
  publish_date: string;
  source_name: string;
}

interface ThemeResult {
  theme: string;
  scheduled: { day: string; story_id: string }[];
  candidates_left: number;
  stock_days: number;
  stock_low: boolean;
}

const STEP = "schedule";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const today = toIsoDate(new Date());
    // Seuls les thèmes suivis sont programmés (themes.followed, posé par apply_run_mode).
    const { data: themes, error: themesError } = await db
      .from("themes").select("id").eq("active", true).eq("coming_soon", false).eq("followed", true).order("position");
    if (themesError) throw new Error(`themes : ${themesError.message}`);

    if (config.schedule_strategy === "one_per_day") {
      const result = await scheduleOnePerDay(db, ((themes ?? []) as { id: string }[]).map((t) => t.id), today, config);
      const images = await checkImageAlerts(db, today, config);
      const total = result.scheduled.length;
      await recordRun(db, { step: STEP, startedAt, processed: total, succeeded: total, failed: 0, error: null });
      return json({ step: STEP, today, strategy: "one_per_day", scheduled: total, reserve: result.reserve, reserve_low: result.reserve_low,
        images_missing: images.missing, image_alerts_resolved: images.resolved, results: result.scheduled });
    }

    const results: ThemeResult[] = [];
    for (const theme of (themes ?? []) as { id: string }[]) {
      const { data: candRows, error: candError } = await db
        .from("stories").select("id, source_name, source_date, created_at, evergreen, score")
        .eq("theme_id", theme.id).eq("status", config.schedule_input_status).is("publish_date", null);
      if (candError) throw new Error(`stories (${theme.id}) : ${candError.message}`);
      let candidates: ScheduleCandidate[] = ((candRows ?? []) as CandidateRow[]).map((r) => ({
        id: r.id, sourceName: r.source_name, sourceDate: r.source_date, createdAt: r.created_at,
        evergreen: r.evergreen, score: r.score,
      }));

      // Jours occupés : programmées ET retirées (le jour reste pris par la mention « retirée », §6).
      const { data: schedRows, error: schedError } = await db
        .from("stories").select("publish_date, source_name")
        .eq("theme_id", theme.id).in("status", ["scheduled", "retracted"])
        .gte("publish_date", addDays(today, -config.schedule_source_window_days));
      if (schedError) throw new Error(`stories programmées (${theme.id}) : ${schedError.message}`);
      const scheduled: ScheduledStory[] = ((schedRows ?? []) as ScheduledRow[]).map((r) => ({
        publishDate: r.publish_date, sourceName: r.source_name,
      }));

      const result: ThemeResult = { theme: theme.id, scheduled: [], candidates_left: 0, stock_days: 0, stock_low: false };
      for (const day of scheduleHorizon(today, config)) {
        const pick = pickForSchedule(candidates, scheduled, day, config);
        if (!pick) continue;
        const { error: updateError } = await db
          .from("stories").update({ status: "scheduled", publish_date: day }).eq("id", pick.id);
        if (updateError) throw new Error(`programmation ${pick.id} : ${updateError.message}`);
        scheduled.push({ publishDate: day, sourceName: pick.sourceName });
        candidates = candidates.filter((c) => c.id !== pick.id);
        result.scheduled.push({ day, story_id: pick.id });
      }

      result.candidates_left = candidates.length;
      result.stock_days = stockDays(scheduled, today);
      result.stock_low = isStockLow(result.stock_days, config);
      const fingerprint = `stock:${theme.id}`;
      const { error: alertError } = result.stock_low
        ? await db.rpc("raise_pipeline_alert", {
          p_kind: "stock_low", p_fingerprint: fingerprint, p_theme_id: theme.id,
          p_message: `stock du thème ${theme.id} : ${result.stock_days} jour(s) programmé(s), seuil ${config.stock_alert_days}`,
          p_details: { stock_days: result.stock_days, candidates_left: result.candidates_left, today },
        })
        : await db.rpc("resolve_pipeline_alert", { p_fingerprint: fingerprint });
      if (alertError) throw new Error(`pipeline_alerts (${theme.id}) : ${alertError.message}`);
      results.push(result);
    }

    const images = await checkImageAlerts(db, today, config);
    const total = results.reduce((n, r) => n + r.scheduled.length, 0);
    await recordRun(db, { step: STEP, startedAt, processed: total, succeeded: total, failed: 0, error: null });
    return json({
      step: STEP, today, scheduled: total, low_stock: results.filter((r) => r.stock_low).map((r) => r.theme),
      images_missing: images.missing, image_alerts_resolved: images.resolved, results,
    });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
