import type { User } from "@supabase/supabase-js";
import { loadProfile, loadThemes } from "./profile.ts";
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
  const [themes, profile] = await Promise.all([loadThemes(), loadProfile(user.id)]);
  return { user, themes, profile };
}
