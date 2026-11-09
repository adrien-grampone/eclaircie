import type { User } from "@supabase/supabase-js";
import { loadProfile, loadThemes, profileThemes } from "./profile.ts";
import { ensureSession } from "./session.ts";
import type { Profile, Theme } from "@/types.ts";

export interface Bootstrap {
  user: User;
  themes: Theme[];
  /** null : nouvel utilisateur, l'onboarding s'impose. */
  profile: Profile | null;
}

/** Démarrage : session anonyme, thèmes, profil éventuel. */
export async function bootstrap(): Promise<Bootstrap> {
  const user = await ensureSession();
  const [themes, stored] = await Promise.all([loadThemes(), loadProfile(user.id)]);
  // Un thème qui n'est plus suivi par le pipeline sort de la sélection ; si rien ne reste, tous les thèmes proposés.
  const kept = stored ? profileThemes(stored.themes, themes) : [];
  const fallback = themes.filter((t) => t.active && !t.coming_soon).map((t) => t.id);
  const profile = stored ? { ...stored, themes: kept.length > 0 ? kept : fallback } : null;
  return { user, themes, profile };
}
