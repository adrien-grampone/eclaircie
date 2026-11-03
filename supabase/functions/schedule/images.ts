/**
 * Alerte `image_missing` : les illustrations sont faites à la main dans le back-office.
 * Une story programmée à J-`image_alert_days` ou moins sans image ouvre une alerte,
 * résolue dès que l'image est déposée (ou que la story n'est plus programmée).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineConfig } from "../_shared/pipeline/config.ts";
import { planImageAlerts, type ImageStatusStory } from "../_shared/pipeline/illustration.ts";
import type { IsoDate } from "../_shared/pipeline/types.ts";

interface ScheduledImageRow {
  id: string;
  theme_id: string;
  publish_date: string;
  image_path: string | null;
}

export interface ImageAlertsResult {
  missing: { story_id: string; theme: string; publish_date: string }[];
  resolved: number;
}

export async function checkImageAlerts(
  db: SupabaseClient,
  today: IsoDate,
  config: Pick<PipelineConfig, "image_alert_days">,
): Promise<ImageAlertsResult> {
  const { data: rows, error } = await db
    .from("stories").select("id, theme_id, publish_date, image_path")
    .eq("status", "scheduled").gte("publish_date", today);
  if (error) throw new Error(`stories programmées (images) : ${error.message}`);
  const scheduled: ImageStatusStory[] = ((rows ?? []) as ScheduledImageRow[]).map((r) => ({
    id: r.id, themeId: r.theme_id, publishDate: r.publish_date, hasImage: r.image_path !== null,
  }));

  const { data: open, error: openError } = await db
    .from("pipeline_alerts").select("fingerprint").eq("kind", "image_missing").is("resolved_at", null);
  if (openError) throw new Error(`pipeline_alerts (images) : ${openError.message}`);
  const openFingerprints = ((open ?? []) as { fingerprint: string }[]).map((r) => r.fingerprint);

  const plan = planImageAlerts(scheduled, openFingerprints, today, config);
  for (const { fingerprint, story } of plan.raise) {
    const { error: raiseError } = await db.rpc("raise_pipeline_alert", {
      p_kind: "image_missing", p_fingerprint: fingerprint, p_theme_id: story.themeId,
      p_message: `story ${story.id} (${story.themeId}) programmée le ${story.publishDate} sans illustration`,
      p_details: { story_id: story.id, publish_date: story.publishDate, today },
    });
    if (raiseError) throw new Error(`raise_pipeline_alert ${fingerprint} : ${raiseError.message}`);
  }
  for (const fingerprint of plan.resolve) {
    const { error: resolveError } = await db.rpc("resolve_pipeline_alert", { p_fingerprint: fingerprint });
    if (resolveError) throw new Error(`resolve_pipeline_alert ${fingerprint} : ${resolveError.message}`);
  }
  return {
    missing: plan.raise.map(({ story }) => ({ story_id: story.id, theme: story.themeId, publish_date: story.publishDate })),
    resolved: plan.resolve.length,
  };
}
