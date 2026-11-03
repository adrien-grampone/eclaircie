import { z } from "zod";
import type { Draft } from "./draft.ts";
import { parseJsonWith } from "./json.ts";
import type { Article, ParseResult, Prompt } from "./types.ts";

/**
 * Étape `verify` (§4.5) — un SECOND appel Sonnet, qui ne voit pas le raisonnement
 * du premier. Il reçoit l'article et le brouillon. La présence des evidences dans
 * le texte est contrôlée en code (checkEvidence), pas ici.
 */
export const VerifySchema = z.object({
  claims: z.array(
    z.object({
      index: z.number().int().min(0),
      supported: z.boolean(),
      note: z.string().default(""),
    }),
  ),
  facts_in_article: z.boolean(),
  no_exaggeration: z.boolean(),
  problems: z.array(z.string()),
  verdict: z.enum(["approve", "reject"]),
});

export type Verify = z.infer<typeof VerifySchema>;

export function parseVerify(json: string): ParseResult<Verify> {
  return parseJsonWith(VerifySchema, json);
}

/**
 * Le moindre doute rejette : verdict `approve`, chaque claim du brouillon évalué
 * exactement une fois et soutenu, chiffres/dates/noms présents, pas
 * d'exagération, aucun problème listé.
 */
export function isVerifyPassed(verify: Verify, draft: Pick<Draft, "claims">): boolean {
  if (verify.verdict !== "approve") return false;
  if (!verify.facts_in_article || !verify.no_exaggeration) return false;
  if (verify.problems.length > 0) return false;
  if (verify.claims.length !== draft.claims.length) return false;

  const seen = new Set<number>();
  for (const entry of verify.claims) {
    if (!entry.supported) return false;
    if (entry.index >= draft.claims.length || seen.has(entry.index)) return false;
    seen.add(entry.index);
  }
  return seen.size === draft.claims.length;
}

export function buildVerifyPrompt(article: Article, draft: Draft): Prompt {
  const system = [
    "Tu es relecteur-vérificateur pour une application qui publie chaque matin une bonne nouvelle sous le label « vérifié et sourcé ». Une seule erreur publiée détruit cette promesse. Tu es donc sévère : le moindre doute = reject.",
    "",
    "Tu reçois un article et un brouillon rédigé par un autre modèle. Vérifie, en te fondant UNIQUEMENT sur l'article :",
    "1. Chaque claim est réellement soutenu par son evidence, et l'evidence dit bien ce que le claim affirme (pas une lecture généreuse).",
    "2. Chaque chiffre, date et nom propre du summary figure dans l'article.",
    "3. Le summary n'exagère pas : « pourrait » ne devient pas « va », une étude sur la souris ne devient pas « un traitement », un objectif ne devient pas un résultat, une corrélation ne devient pas une cause.",
    "4. La nouvelle est bien positive sans contrepartie cachée dans l'article.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "claims": [ { "index": 0, "supported": true, "note": "" } ],',
    '  "facts_in_article": true,',
    '  "no_exaggeration": true,',
    '  "problems": [],',
    '  "verdict": "approve"',
    "}",
    "",
    "`claims` contient une entrée par claim du brouillon, dans l'ordre, avec son index (à partir de 0). `problems` liste en français chaque problème constaté. `verdict` vaut \"approve\" seulement si tout est irréprochable, sinon \"reject\".",
  ].join("\n");

  const claims = draft.claims
    .map((c, i) => `${i}. CLAIM : ${c.claim}\n   EVIDENCE : ${c.evidence}`)
    .join("\n");

  const user = [
    "ARTICLE",
    `Source : ${article.sourceName}`,
    `Titre : ${article.title}`,
    "<<<",
    article.fullText,
    ">>>",
    "",
    "BROUILLON À VÉRIFIER",
    `Titre : ${draft.title_main} ${draft.title_accent}`.trim(),
    `Résumé : ${draft.summary}`,
    `Pourquoi c'est bien : ${draft.why_good}`,
    "Claims :",
    claims,
  ].join("\n");

  return { system, user };
}
