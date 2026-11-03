import { redirect } from "next/navigation";
import { isAllowedEmail } from "./env.ts";
import { sessionClient } from "./supabase.ts";

/** Email de l'administrateur connecté, ou redirection vers /login. proxy.ts fait la même garde en amont. */
export async function requireAdmin(): Promise<string> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  if (!isAllowedEmail(email)) redirect("/login");
  return email as string;
}
