import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase.ts";

/** Auth anonyme au premier lancement : réutilise la session existante, sinon en crée une. */
export async function ensureSession(): Promise<User> {
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user) {
    console.log(`session reprise : utilisateur ${current.session.user.id}`);
    return current.session.user;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`connexion anonyme : ${error.message}`);
  if (!data.user) throw new Error("connexion anonyme : pas d'utilisateur");
  console.log(`session créée : utilisateur ${data.user.id}`);
  return data.user;
}
