import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseConfig, type PipelineConfig } from "./pipeline/config.ts";

/** Client service_role : réservé aux Edge Functions, jamais exposé à l'app. */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function loadConfig(db: SupabaseClient): Promise<PipelineConfig> {
  const { data, error } = await db.from("pipeline_config").select("key, value");
  if (error) throw new Error(`pipeline_config : ${error.message}`);
  const parsed = parseConfig(data ?? []);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** Début du jour courant (UTC) : la fenêtre des garde-fous journaliers. */
export function startOfTodayUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Nombre d'éléments déjà traités aujourd'hui par une étape, d'après pipeline_runs. */
export async function processedToday(db: SupabaseClient, step: string): Promise<number> {
  const { data, error } = await db
    .from("pipeline_runs")
    .select("processed")
    .eq("step", step)
    .gte("started_at", startOfTodayUtc());
  if (error) throw new Error(`pipeline_runs : ${error.message}`);
  const rows = (data ?? []) as { processed: number | null }[];
  return rows.reduce((sum, r) => sum + (r.processed ?? 0), 0);
}

export interface RunSummary {
  step: string;
  startedAt: string;
  processed: number;
  succeeded: number;
  failed: number;
  error: string | null;
}

export async function recordRun(db: SupabaseClient, run: RunSummary): Promise<void> {
  const { error } = await db.from("pipeline_runs").insert({
    step: run.step,
    started_at: run.startedAt,
    processed: run.processed,
    succeeded: run.succeeded,
    failed: run.failed,
    error: run.error,
  });
  if (error) console.error(`pipeline_runs insert : ${error.message}`);
}
