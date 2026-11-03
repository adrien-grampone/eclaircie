import { normalizeText } from "./normalize.ts";
import type { Claim } from "./types.ts";

export interface EvidenceCheck {
  ok: boolean;
  /** Les claims dont l'evidence n'a pas été retrouvée dans le texte. */
  missing: Claim[];
}

/**
 * Contrôle en code (§4.5) : chaque `evidence` doit être retrouvée telle quelle
 * dans le texte de l'article, après normalisation des espaces, guillemets,
 * apostrophes typographiques et de la casse. Une evidence vide est manquante.
 */
export function checkEvidence(claims: readonly Claim[], fullText: string): EvidenceCheck {
  const haystack = normalizeText(fullText);
  const missing = claims.filter((claim) => {
    const needle = normalizeText(claim.evidence);
    return needle.length === 0 || !haystack.includes(needle);
  });
  return { ok: missing.length === 0, missing };
}
