import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import type { Draft } from "./draft.ts";
import { parseJsonWith } from "./json.ts";
import type { Article, ParseResult, Prompt } from "./types.ts";

/**
 * Étape `verify` (§4.5) — un SECOND appel Sonnet, qui ne voit pas le raisonnement
 * du premier. La présence des evidences dans le texte est contrôlée en code
 * (checkEvidence), pas ici. La décision finale est prise en code (decideVerify).
 */
export const PROBLEM_TYPES = ["fact_error", "overstatement", "missing_caveat", "translation_issue"] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const VerifyProblemSchema = z.object({
  type: z.enum(PROBLEM_TYPES),
  passage: z.string().trim().min(1),
  correction: z.string().trim().min(1),
});
export type VerifyProblem = z.infer<typeof VerifyProblemSchema>;

export const VerifySchema = z.object({
  claims: z.array(
    z.object({
      index: z.number().int().min(0),
      supported: z.boolean(),
      note: z.string().default(""),
    }),
  ),
  problems: z.array(VerifyProblemSchema),
  verdict: z.enum(["approve", "reject"]),
});
export type Verify = z.infer<typeof VerifySchema>;

export function parseVerify(json: string): ParseResult<Verify> {
  return parseJsonWith(VerifySchema, json);
}

export type VerifyDecision = "verified" | "revise" | "rejected";

export interface Decision {
  decision: VerifyDecision;
  /** Raison lisible en cas de rejet ou de révision. */
  reason: string | null;
}

/**
 * Décision en code, quoi que dise le verdict du modèle :
 * - un claim non soutenu, ou une liste de claims incohérente → rejet (c'est un fait) ;
 * - au moins un `fact_error` → rejet définitif ;
 * - d'autres problèmes → révision si on n'a pas atteint `verify_max_passes`, sinon rejet ;
 * - aucun problème mais verdict `reject` → rejet (le doute l'emporte) ;
 * - aucun problème et verdict `approve` → validé.
 */
export function decideVerify(
  verify: Verify,
  draft: Pick<Draft, "claims">,
  pass: number,
  config: Pick<PipelineConfig, "verify_max_passes">,
): Decision {
  const indices = new Set(verify.claims.map((c) => c.index));
  const coherent =
    verify.claims.length === draft.claims.length &&
    indices.size === draft.claims.length &&
    [...indices].every((i) => i < draft.claims.length);
  if (!coherent) return { decision: "rejected", reason: "verify_failed: liste de claims incohérente" };

  const unsupported = verify.claims.filter((c) => !c.supported);
  if (unsupported.length > 0) {
    const notes = unsupported.map((c) => `claim ${c.index}: ${c.note || "non soutenu"}`).join(" | ");
    return { decision: "rejected", reason: `fact_error: ${notes}` };
  }

  const factErrors = verify.problems.filter((p) => p.type === "fact_error");
  if (factErrors.length > 0) {
    return { decision: "rejected", reason: `fact_error: ${factErrors.map((p) => p.passage).join(" | ")}` };
  }

  if (verify.problems.length > 0) {
    const summary = verify.problems.map((p) => `${p.type}: ${p.passage}`).join(" | ");
    if (pass >= config.verify_max_passes) {
      return { decision: "rejected", reason: `verify_failed après ${pass} passe(s): ${summary}` };
    }
    return { decision: "revise", reason: summary };
  }

  if (verify.verdict !== "approve") return { decision: "rejected", reason: "verify_failed: verdict reject sans problème listé" };
  return { decision: "verified", reason: null };
}

export function buildVerifyPrompt(article: Article, draft: Draft): Prompt {
  const system = [
    "Tu es relecteur-vérificateur pour une application qui publie chaque matin une bonne nouvelle sous le label « vérifié et sourcé ». Une seule erreur publiée détruit cette promesse. Tu es sévère sur les faits, mais tu classes chaque problème pour qu'un rédacteur puisse corriger.",
    "",
    "Tu reçois un article et un brouillon rédigé par un autre modèle. Vérifie, en te fondant UNIQUEMENT sur l'article :",
    "1. Chaque claim est réellement soutenu par son evidence, et l'evidence dit bien ce que le claim affirme (pas une lecture généreuse).",
    "2. Chaque chiffre, date et nom propre du titre et du résumé figure dans l'article, avec la même portée.",
    "3. Le texte n'exagère pas : « pourrait » ne devient pas « va », une étude sur la souris ne devient pas « un traitement », un objectif ne devient pas un résultat, une corrélation ne devient pas une cause.",
    "4. Si l'article contient une limite, une opposition ou une contrepartie importante, le résumé la mentionne.",
    "",
    "TYPES DE PROBLÈMES",
    "- fact_error : un fait, un chiffre, un nom ou un lien de causalité que l'article ne dit pas, ou contredit. Rejet définitif.",
    "- overstatement : terme plus fort ou plus certain que la source (certitude pour un espoir, résultat pour un plan, généralisation).",
    "- missing_caveat : une limite, opposition ou contrepartie importante de l'article est passée sous silence.",
    "- translation_issue : traduction qui ajoute une précision ou change le sens (« beetles » → « carabes »). Une traduction FIDÈLE d'un terme anglais n'est PAS un problème, même si le mot français n'apparaît pas dans l'article.",
    "",
    "Pour chaque problème, cite le passage fautif du brouillon tel quel et propose une correction concrète. Ne signale pas deux fois le même problème. Ne signale rien qui ne soit pas un problème.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "claims": [ { "index": 0, "supported": true, "note": "" } ],',
    '  "problems": [ { "type": "overstatement", "passage": "…", "correction": "…" } ],',
    '  "verdict": "approve"',
    "}",
    "",
    "`claims` contient une entrée par claim du brouillon, dans l'ordre, avec son index (à partir de 0). `verdict` vaut \"approve\" seulement si `problems` est vide, sinon \"reject\".",
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
    "Claims :",
    claims,
  ].join("\n");

  return { system, user };
}
