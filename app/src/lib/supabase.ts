import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase de l'app : URL et clé anon UNIQUEMENT (EXPO_PUBLIC_*). Jamais de clé service_role ici.
 * La session anonyme est persistée dans AsyncStorage : un relancement garde le même utilisateur.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont requis (app/.env)");

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
