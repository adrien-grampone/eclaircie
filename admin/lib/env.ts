/** Variables d'environnement du back-office, lues côté serveur seulement. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function supabaseUrl(): string {
  return required("SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required("SUPABASE_ANON_KEY");
}

export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

/** Emails autorisés à entrer, en minuscules. Vide = personne. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== "");
}

export function isAllowedEmail(email: string | null | undefined, allowed: readonly string[] = adminEmails()): boolean {
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/** URL publique d'un fichier du bucket `illustrations`. */
export function illustrationUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/illustrations/${path}`;
}
