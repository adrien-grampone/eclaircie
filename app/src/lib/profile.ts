import { supabase } from "./supabase.ts";
import type { Profile, Theme } from "@/types.ts";

/**
 * Thèmes proposés dans l'app : seulement les thèmes suivis par le pipeline (themes.followed, réglé dans
 * pipeline_config.followed_themes), plus les thèmes « bientôt » affichés en avant-première.
 */
export async function loadThemes(): Promise<Theme[]> {
  const { data, error } = await supabase.from("themes").select("id, label, position, palette, active, coming_soon, followed").order("position");
  if (error) throw new Error(`themes : ${error.message}`);
  return visibleThemes(data as (Theme & { followed: boolean })[]);
}

export function visibleThemes(rows: readonly (Theme & { followed: boolean })[]): Theme[] {
  return rows.filter((t) => t.followed || t.coming_soon).map(({ followed: _followed, ...theme }) => theme);
}

/** Les thèmes du profil qui sont encore proposés (un thème qui n'est plus suivi disparaît de la sélection). */
export function profileThemes(profileThemeIds: readonly string[], themes: readonly Theme[]): string[] {
  return profileThemeIds.filter((id) => themes.some((t) => t.id === id && t.active && !t.coming_soon));
}

/** Profil de l'utilisateur, ou null s'il n'a pas encore fait l'onboarding. */
export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`profil : ${error.message}`);
  return (data as Profile | null) ?? null;
}

/** Écrit (ou réécrit) le profil à la fin de l'onboarding. */
export async function saveProfile(userId: string, row: { themes: string[]; notify_time: string; timezone: string }): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").upsert({ user_id: userId, ...row }).select("*").single();
  if (error) throw new Error(`profil : ${error.message}`);
  return data as Profile;
}

/** Fuseau de l'appareil (Intl de Hermes), sinon celui par défaut de la base. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}
