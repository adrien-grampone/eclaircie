import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env.ts";

/** Client service_role : toutes les lectures et écritures du back-office, jamais envoyé au navigateur. */
export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), { auth: { persistSession: false } });
}

/** Client lié à la session (cookies) : sert uniquement à savoir qui est connecté. */
export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : les cookies sont rafraîchis par proxy.ts.
        }
      },
    },
  });
}
