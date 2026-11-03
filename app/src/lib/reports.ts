import { reportFailureMessage, type ReportRow } from "./report.ts";
import { supabase } from "./supabase.ts";

/** Insère le signalement (RLS : insertion seulement, au nom de l'utilisateur). */
export async function submitReport(row: ReportRow): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("error_reports").insert(row);
  if (error) return { ok: false, message: reportFailureMessage(error.code) };
  return { ok: true };
}
