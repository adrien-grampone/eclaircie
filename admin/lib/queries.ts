import { addDays, toIsoDate } from "@pipeline/dates.ts";
import { buildIllustrationPrompt, fallbackPrefix } from "@pipeline/illustration.ts";
import { adminClient } from "./supabase.ts";
import type { AlertRow, ReportRow, RunRow, StoryRow, ThemeRow } from "./types.ts";

export const STORY_COLUMNS =
  "id, theme_id, title_main, title_accent, summary, claims, scene, source_name, source_url, source_date, score, evergreen, image_path, status, reject_reason, publish_date, approved_at, created_at";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context} : ${error?.message ?? "erreur inconnue"}`);
}

export function today(): string {
  return toIsoDate(new Date());
}

export interface AdminConfig {
  schedule_horizon_days: number;
  image_alert_days: number;
  stock_alert_days: number;
}

export async function loadAdminConfig(): Promise<AdminConfig> {
  const { data, error } = await adminClient().from("pipeline_config").select("key, value")
    .in("key", ["schedule_horizon_days", "image_alert_days", "stock_alert_days"]);
  if (error) fail("pipeline_config", error);
  const map = new Map((data as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const num = (key: string): number => {
    const v = map.get(key);
    if (typeof v !== "number") throw new Error(`pipeline_config.${key} manquant`);
    return v;
  };
  return { schedule_horizon_days: num("schedule_horizon_days"), image_alert_days: num("image_alert_days"), stock_alert_days: num("stock_alert_days") };
}

export async function loadThemes(): Promise<ThemeRow[]> {
  const { data, error } = await adminClient().from("themes").select("*").order("position");
  if (error) fail("themes", error);
  return data as ThemeRow[];
}

export interface ImageTask {
  story: StoryRow;
  theme: ThemeRow;
  prompt: string;
}

/** Stories programmées sur l'horizon, sans image, par date de publication croissante. */
export async function imagesToDo(config: AdminConfig): Promise<{ tasks: ImageTask[]; nextDue: string | null }> {
  const start = today();
  const { data, error } = await adminClient().from("stories").select(STORY_COLUMNS)
    .eq("status", "scheduled").is("image_path", null)
    .gte("publish_date", start).lte("publish_date", addDays(start, config.schedule_horizon_days))
    .order("publish_date", { ascending: true });
  if (error) fail("stories (images)", error);
  const themes = new Map((await loadThemes()).map((t) => [t.id, t]));
  const tasks: ImageTask[] = [];
  for (const story of data as StoryRow[]) {
    const theme = themes.get(story.theme_id);
    if (!theme) continue;
    const scene = story.scene ?? "";
    const prompt = scene.trim() === "" ? "(scene vide : à écrire dans la fiche)" : buildIllustrationPrompt({ paletteWords: theme.palette_words, scene });
    tasks.push({ story, theme, prompt });
  }
  return { tasks, nextDue: tasks[0]?.story.publish_date ?? null };
}

export interface FallbackSet {
  theme: ThemeRow;
  files: string[];
}

/** Images de secours par thème, listées dans le bucket. */
export async function fallbackSets(): Promise<FallbackSet[]> {
  const storage = adminClient().storage.from("illustrations");
  const sets: FallbackSet[] = [];
  for (const theme of await loadThemes()) {
    if (!theme.active) continue;
    const { data, error } = await storage.list(fallbackPrefix(theme.id).slice(0, -1), { limit: 100 });
    if (error) fail(`bucket fallback/${theme.id}`, error);
    const files = (data ?? []).map((f) => f.name).filter((n) => !n.startsWith(".")).map((n) => `${fallbackPrefix(theme.id)}${n}`);
    sets.push({ theme, files });
  }
  return sets;
}

/** Stories vérifiées ou programmées dont le texte n'a pas encore été validé. */
export async function reviewQueue(): Promise<StoryRow[]> {
  const { data, error } = await adminClient().from("stories").select(STORY_COLUMNS)
    .in("status", ["verified", "scheduled"]).is("approved_at", null)
    .order("publish_date", { ascending: true, nullsFirst: false }).order("score", { ascending: false }).limit(100);
  if (error) fail("stories (validation)", error);
  return data as StoryRow[];
}

export async function loadStory(id: string): Promise<StoryRow> {
  const { data, error } = await adminClient().from("stories").select(STORY_COLUMNS).eq("id", id).single();
  if (error) fail(`story ${id}`, error);
  return data as StoryRow;
}

export interface ThemeStock {
  theme: ThemeRow;
  days: number;
  firstGap: string;
  withoutImage: number;
  scheduled: Pick<StoryRow, "id" | "publish_date" | "title_main" | "image_path" | "approved_at">[];
}

/** Jours programmés par thème à partir d'aujourd'hui, premier trou, images manquantes. */
export async function stockByTheme(config: AdminConfig): Promise<ThemeStock[]> {
  const start = today();
  const { data, error } = await adminClient().from("stories").select("id, theme_id, publish_date, title_main, image_path, approved_at")
    .eq("status", "scheduled").gte("publish_date", start).order("publish_date");
  if (error) fail("stories (stock)", error);
  const rows = data as (Pick<StoryRow, "id" | "theme_id" | "publish_date" | "title_main" | "image_path" | "approved_at">)[];
  const result: ThemeStock[] = [];
  for (const theme of await loadThemes()) {
    if (!theme.active || theme.coming_soon) continue;
    const scheduled = rows.filter((r) => r.theme_id === theme.id);
    const dates = new Set(scheduled.map((r) => r.publish_date));
    let firstGap = start;
    for (let i = 0; i <= config.schedule_horizon_days; i++) {
      const day = addDays(start, i);
      if (!dates.has(day)) { firstGap = day; break; }
      firstGap = addDays(start, i + 1);
    }
    result.push({ theme, days: dates.size, firstGap, withoutImage: scheduled.filter((r) => r.image_path === null).length, scheduled });
  }
  return result;
}

export async function recentReports(): Promise<ReportRow[]> {
  const { data, error } = await adminClient().from("error_reports")
    .select("id, story_id, reason, message, created_at, stories(id, title_main, title_accent, status, publish_date, theme_id)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) fail("error_reports", error);
  return data as unknown as ReportRow[];
}

export interface StepHealth {
  step: string;
  lastRun: string;
  runs24h: number;
  processed24h: number;
  errors24h: number;
  lastError: string | null;
}

export interface Health {
  openAlerts: AlertRow[];
  recentResolved: AlertRow[];
  steps: StepHealth[];
  articlesByStatus: { status: string; count: number }[];
}

export async function health(): Promise<Health> {
  const db = adminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [alerts, runs, articles] = await Promise.all([
    db.from("pipeline_alerts").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("pipeline_runs").select("*").gte("started_at", since).order("started_at", { ascending: false }).limit(2000),
    db.from("raw_articles_status_counts").select("status, count"),
  ]);
  if (alerts.error) fail("pipeline_alerts", alerts.error);
  if (runs.error) fail("pipeline_runs", runs.error);
  if (articles.error) fail("raw_articles_status_counts", articles.error);
  const steps = new Map<string, StepHealth>();
  for (const run of runs.data as RunRow[]) {
    const s = steps.get(run.step) ?? { step: run.step, lastRun: run.started_at, runs24h: 0, processed24h: 0, errors24h: 0, lastError: null };
    s.runs24h += 1;
    s.processed24h += run.processed ?? 0;
    if (run.error) { s.errors24h += 1; s.lastError ??= run.error; }
    steps.set(run.step, s);
  }
  const all = alerts.data as AlertRow[];
  return {
    openAlerts: all.filter((a) => a.resolved_at === null),
    recentResolved: all.filter((a) => a.resolved_at !== null).slice(0, 20),
    steps: [...steps.values()].sort((a, b) => a.step.localeCompare(b.step)),
    articlesByStatus: articles.data as { status: string; count: number }[],
  };
}
