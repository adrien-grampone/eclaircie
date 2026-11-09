/**
 * Garde des Edge Functions du pipeline. Elles ne sont appelées que par pg_cron (invoke_pipeline_function) et par
 * scripts/pipeline-pass.sh, jamais par l'app : verify_jwt est désactivé (la clé anon de l'app est un JWT valide,
 * elle ne protégerait rien). Chaque appel doit donc porter `Authorization: Bearer <PIPELINE_FUNCTIONS_KEY>`,
 * secret partagé stocké dans les secrets des fonctions et dans Vault (`pipeline_functions_key`).
 * Sans secret configuré côté serveur, tout est refusé (jamais ouvert par défaut).
 */

const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/**
 * Égalité en temps constant : les deux valeurs sont d'abord hachées (même longueur, quelle que soit l'entrée),
 * puis toutes les octets sont comparés sans sortie anticipée.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Le jeton d'un en-tête `Authorization: Bearer <jeton>`, ou null. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match?.[1] ?? null;
}

export type AuthDecision = { ok: true } | { ok: false; status: 401 | 500; error: string };

/** Décision pure (testée) : secret serveur absent → 500, jeton absent ou faux → 401. */
export async function checkPipelineKey(header: string | null, expected: string | undefined): Promise<AuthDecision> {
  if (!expected) return { ok: false, status: 500, error: "PIPELINE_FUNCTIONS_KEY non configurée" };
  const token = bearerToken(header);
  if (!token || !(await constantTimeEqual(token, expected))) return { ok: false, status: 401, error: "non autorisé" };
  return { ok: true };
}
