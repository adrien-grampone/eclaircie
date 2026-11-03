import { supabase } from "./supabase.ts";
import type { Profile, Theme } from "@/types.ts";

export async function loadThemes(): Promise<Theme[]> {
  const { data, error } = await supabase.from("themes").select("id, label, position, palette, active, coming_soon").order("position");
  if (error) throw new Error(`themes : ${error.message}`);
  return data as Theme[];
}

/**
 * Profil de l'utilisateur. Tant que l'onboarding n'existe pas : un PROFIL DE DEV avec tous les
 * thèmes actifs est créé au premier lancement (à retirer quand l'écran Choix des thèmes arrivera).
 */
export async function loadOrCreateDevProfile(userId: string, themes: readonly Theme[]): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`profil : ${error.message}`);
  if (data) return data as Profile;
  const all = themes.filter((t) => t.active && !t.coming_soon).map((t) => t.id);
  const { data: created, error: insertError } = await supabase.from("profiles")
    .insert({ user_id: userId, themes: all }).select("*").single();
  if (insertError) throw new Error(`profil de dev : ${insertError.message}`);
  return created as Profile;
}
