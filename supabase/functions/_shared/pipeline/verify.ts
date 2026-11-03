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
export const PROBLEM_TYPES = ["fact_error", "overstatement", "missing_caveat", "translation_issue", "tone_negative"] as const;
/** Types qui rejettent définitivement, à n'importe quelle passe. */
export const FATAL_TYPES: readonly ProblemType[] = ["fact_error", "tone_negative"];
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
  /** Passe 2 seulement : une entrée par problème de la passe précédente. */
  previous_problems: z.array(z.object({ index: z.number().int().min(0), fixed: z.boolean(), note: z.string().default("") })).default([]),
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

function claimsCoherent(verify: Verify, draft: Pick<Draft, "claims">): boolean {
  const indices = new Set(verify.claims.map((c) => c.index));
  return (
    verify.claims.length === draft.claims.length &&
    indices.size === draft.claims.length &&
    [...indices].every((i) => i < draft.claims.length)
  );
}

/**
 * Décision en code, quoi que dise le verdict du modèle.
 * Passe 1 : un claim non soutenu, un `fact_error` ou un `tone_negative` → rejet ;
 *   d'autres problèmes → révision ; rien → validé.
 * Passe 2 et suivantes : chaque problème de la passe précédente doit être corrigé,
 *   sinon rejet ; seuls les types fatals comptent parmi les nouveaux problèmes
 *   (pas de nouvel overstatement / missing_caveat / translation_issue) ; au-delà de
 *   `verify_max_passes`, tout problème restant rejette.
 */
export function decideVerify(
  verify: Verify,
  draft: Pick<Draft, "claims">,
  pass: number,
  config: Pick<PipelineConfig, "verify_max_passes">,
  previousProblems: readonly VerifyProblem[] = [],
): Decision {
  if (!claimsCoherent(verify, draft)) {
    return { decision: "rejected", reason: "verify_failed: liste de claims incohérente" };
  }

  const unsupported = verify.claims.filter((c) => !c.supported);
  if (unsupported.length > 0) {
    const notes = unsupported.map((c) => `claim ${c.index}: ${c.note || "non soutenu"}`).join(" | ");
    return { decision: "rejected", reason: `fact_error: ${notes}` };
  }

  const fatal = verify.problems.filter((p) => FATAL_TYPES.includes(p.type));
  if (fatal.length > 0) {
    return { decision: "rejected", reason: fatal.map((p) => `${p.type}: ${p.passage}`).join(" | ") };
  }

  if (pass > 1) {
    const assessed = new Map(verify.previous_problems.map((p) => [p.index, p]));
    const unresolved = previousProblems
      .map((p, i) => ({ problem: p, status: assessed.get(i) }))
      .filter(({ status }) => !status || !status.fixed);
    if (unresolved.length > 0) {
      const list = unresolved.map(({ problem, status }) => `${problem.type}: ${problem.passage}${status?.note ? ` (${status.note})` : ""}`).join(" | ");
      return { decision: "rejected", reason: `verify_failed après ${pass} passe(s), non corrigé : ${list}` };
    }
    // Les nouveaux problèmes non fatals ne sont pas pris en compte en passe 2 : c'est voulu.
    return { decision: "verified", reason: null };
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

export interface VerifyContext {
  pass: number;
  /** Problèmes relevés à la passe précédente (passe 2). */
  previousProblems: readonly VerifyProblem[];
}

const FIRST_PASS: VerifyContext = { pass: 1, previousProblems: [] };

export function buildVerifyPrompt(article: Article, draft: Draft, context: VerifyContext = FIRST_PASS): Prompt {
  const secondPass = context.pass > 1;
  const system = [
    "Tu es relecteur-vérificateur pour une application qui publie chaque matin une bonne nouvelle sous le label « vérifié et sourcé ». Une seule erreur publiée détruit cette promesse. Tu es sévère sur les faits, mais tu classes chaque problème pour qu'un rédacteur puisse corriger.",
    "",
    "Tu reçois un article et un brouillon rédigé par un autre modèle. Vérifie, en te fondant UNIQUEMENT sur l'article :",
    "1. Chaque claim est réellement soutenu par son evidence, et l'evidence dit bien ce que le claim affirme (pas une lecture généreuse).",
    "2. Chaque chiffre, date et nom propre du titre et du résumé figure dans l'article, avec la même portée.",
    "3. Le texte n'exagère pas : « pourrait » ne devient pas « va », une étude sur la souris ne devient pas « un traitement », un objectif ne devient pas un résultat, une corrélation ne devient pas une cause.",
    "4. Si l'article contient une limite, une opposition ou une contrepartie qui change le sens de cette nouvelle, le résumé la mentionne. Un contexte général négatif absent du résumé n'est PAS un problème.",
    "5. Le résumé se lit comme une bonne nouvelle : s'il se lit globalement comme une mauvaise nouvelle, c'est un `tone_negative`.",
    "",
    "LE TITRE (title_main + title_accent) n'est jugé que sur DEUX points : il n'ajoute aucun fait absent du résumé, et il ne contredit pas le résumé. Son ton évocateur est voulu : ne signale jamais un titre pour son ton, son image ou sa chute.",
    "",
    secondPass
      ? "SECONDE PASSE : ce brouillon est une révision. Pour chaque problème de la passe précédente, dis s'il est corrigé (`previous_problems`, même index). Parmi les problèmes nouveaux, cherche UNIQUEMENT des fact_error ou un tone_negative : ne signale aucun nouvel overstatement, missing_caveat ou translation_issue."
      : "PREMIÈRE PASSE : relève tous les problèmes.",
    "",
    "TYPES DE PROBLÈMES",
    "- fact_error : un fait, un chiffre, un nom ou un lien de causalité que l'article ne dit pas, ou contredit. Rejet définitif.",
    "  Un claim dont le fait de base est dans l'article mais qui ajoute un simple qualificatif (« mieux », « nombreux », « enfin ») reste `supported: true` : signale le qualificatif en overstatement, pas en fact_error.",
    "- overstatement : terme plus fort ou plus certain que la source (certitude pour un espoir, résultat pour un plan, généralisation).",
    "- missing_caveat : une limite, opposition ou contrepartie importante de l'article est passée sous silence.",
    "- translation_issue : traduction qui ajoute une précision ou change le sens (« beetles » → « carabes »). RAPPEL : une traduction FIDÈLE d'un mot anglais n'est JAMAIS un translation_issue (« folly » → « insensé » est correct), même si le mot français n'apparaît pas dans l'article.",
    "- tone_negative : le résumé se lit globalement comme une mauvaise nouvelle. Rejet définitif.",
    "",
    "Pour chaque problème, cite le passage fautif du brouillon tel quel et propose une correction concrète. Ne signale pas deux fois le même problème. Ne signale rien qui ne soit pas un problème.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "claims": [ { "index": 0, "supported": true, "note": "" } ],',
    '  "problems": [ { "type": "overstatement", "passage": "…", "correction": "…" } ],',
    secondPass ? '  "previous_problems": [ { "index": 0, "fixed": true, "note": "" } ],' : '  "previous_problems": [],',
    '  "verdict": "approve"',
    "}",
    "",
    "`claims` contient une entrée par claim du brouillon, dans l'ordre, avec son index (à partir de 0). `verdict` vaut \"approve\" seulement si `problems` est vide, sinon \"reject\".",
  ].join("\n");

  const previous = context.previousProblems
    .map((p, i) => `${i}. [${p.type}] « ${p.passage} » → correction demandée : ${p.correction}`)
    .join("\n");

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
    ...(secondPass ? ["", "PROBLÈMES DE LA PASSE PRÉCÉDENTE", previous] : []),
  ].join("\n");

  return { system, user };
}
