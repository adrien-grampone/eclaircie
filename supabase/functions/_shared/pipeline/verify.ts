import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import type { Draft } from "./draft.ts";
import { parseJsonWith } from "./json.ts";
import { applyEditorialRules } from "./editorial.ts";
import type { Triage } from "./triage.ts";
import type { Article, ParseResult, Prompt, ThemeRef } from "./types.ts";

/**
 * Étape `verify` (§4.5) — un SECOND appel Sonnet, qui ne voit pas le raisonnement
 * du premier. La présence des evidences dans le texte est contrôlée en code
 * (checkEvidence), pas ici. La décision finale est prise en code (decideVerify).
 */
export const PROBLEM_TYPES = [
  "fact_error", "overstatement", "missing_caveat", "translation_issue", "tone_negative",
  /** Le titre ne nomme pas le sujet concret, il ne se comprend pas sans le résumé. Révision. */
  "vague_title",
  /** Le résultat principal n'est qu'une possibilité et l'article ne mesure rien. Rejet. */
  "not_a_fact",
  /** Le thème principal ne correspond pas au sujet : corrigé en code si le thème proposé est autorisé. */
  "theme_mismatch",
] as const;
/** Types qui rejettent définitivement, à n'importe quelle passe. */
export const FATAL_TYPES: readonly ProblemType[] = ["fact_error", "tone_negative", "not_a_fact"];
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const VerifyProblemSchema = z.object({
  type: z.enum(PROBLEM_TYPES),
  passage: z.string().trim().min(1),
  correction: z.string().trim().min(1),
  /** theme_mismatch seulement : identifiant du thème proposé. */
  theme: z.string().trim().min(1).optional(),
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

/** Problèmes qu'un rédacteur peut corriger : tout sauf le thème, qui est traité en code. */
export function revisableProblems(problems: readonly VerifyProblem[]): VerifyProblem[] {
  return problems.filter((p) => p.type !== "theme_mismatch");
}

export type ThemeResolution =
  | { action: "keep" }
  | { action: "change"; theme: string }
  | { action: "reject"; reason: string };

/**
 * Un `theme_mismatch` corrige le thème principal SANS rejet si le thème proposé existe et reste
 * autorisé par les règles de §2 (kind, study_subject) ; sinon la story est rejetée.
 */
export function resolveThemeMismatch(
  problems: readonly VerifyProblem[],
  current: string,
  triage: Pick<Triage, "kind" | "study_subject">,
  themes: readonly ThemeRef[],
  /** Thèmes non suivis : les proposer ne change rien (la nouvelle garde son thème suivi). */
  unfollowed: readonly string[] = [],
): ThemeResolution {
  const mismatch = problems.find((p) => p.type === "theme_mismatch");
  if (!mismatch) return { action: "keep" };
  const proposed = mismatch.theme;
  if (proposed && unfollowed.includes(proposed)) return { action: "keep" };
  if (!proposed || !themes.some((t) => t.id === proposed)) {
    return { action: "reject", reason: `theme_mismatch: thème proposé absent ou inconnu (${proposed ?? "aucun"}) — ${mismatch.passage}` };
  }
  if (proposed === current) return { action: "keep" };
  const ruled = applyEditorialRules({
    is_good_news: true, themes: [proposed], kind: triage.kind, study_subject: triage.study_subject,
    is_fact: true, is_promotional: false, is_scheduled_event: false, is_food_health_claim: false,
    positivity: 1, significance: 1, evergreen: false, reason: "",
    concrete: 1, accomplished: 1, closeness: 1, magnitude: 1, before_after: 1, preliminary: false, too_technical: false,
  });
  if (ruled.reason || ruled.triage.themes[0] !== proposed) {
    return { action: "reject", reason: `theme_mismatch: ${proposed} non autorisé (${ruled.reason ?? "règle de thème"}) — ${mismatch.passage}` };
  }
  return { action: "change", theme: proposed };
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

  // Le thème est traité à part (resolveThemeMismatch) : il ne compte ni pour la révision ni pour le rejet.
  const problems = revisableProblems(verify.problems);
  const fatal = problems.filter((p) => FATAL_TYPES.includes(p.type));
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

  if (problems.length > 0) {
    const summary = problems.map((p) => `${p.type}: ${p.passage}`).join(" | ");
    if (pass >= config.verify_max_passes) {
      return { decision: "rejected", reason: `verify_failed après ${pass} passe(s): ${summary}` };
    }
    return { decision: "revise", reason: summary };
  }

  // Un verdict reject qui ne listait qu'un theme_mismatch (traité en code) n'est pas un doute.
  if (verify.verdict !== "approve" && verify.problems.length === 0) return { decision: "rejected", reason: "verify_failed: verdict reject sans problème listé" };
  return { decision: "verified", reason: null };
}

export interface VerifyContext {
  pass: number;
  /** Problèmes relevés à la passe précédente (passe 2). */
  previousProblems: readonly VerifyProblem[];
  /** Thème principal actuel et thèmes disponibles, pour juger la cohérence du thème. */
  theme?: { current: string; available: readonly ThemeRef[] };
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
    "6. « Pourrait » : si le résultat principal du titre ou du résumé n'est qu'une possibilité (« pourrait mieux dépister », « pourrait ouvrir la voie »), regarde l'article. S'il décrit un résultat MESURÉ, c'est un `overstatement` à reformuler au fait mesuré. S'il n'y a aucun résultat mesuré, c'est un `not_a_fact` : ce n'est pas une nouvelle.",
    "7. Le thème principal (indiqué ci-dessous) doit correspondre au sujet réel de l'article : des plaquettes sanguines ne sont pas « Animaux », une étude sur la souris n'est pas « Santé ». Sinon, `theme_mismatch` avec, dans `theme`, l'identifiant du thème correct parmi la liste.",
    "",
    "LE TITRE (title_main + title_accent) est jugé sur TROIS points : il n'ajoute aucun fait absent du résumé ; il ne contredit pas le résumé ; un lecteur sans culture scientifique comprend SEUL ce qui s'est passé (sinon `vague_title`). Il est volontairement simple et sans jargon : un sujet concret décrit en mots courants (« un arbre préhistorique », « une sonde européenne », « des chiens qui saignent ») suffit. N'exige JAMAIS un nom propre, un nom scientifique, un sigle ou un terme technique : en réclamer un est une erreur de relecture. Ne signale jamais un titre pour son ton, sa simplicité ou sa coupe en deux parties.",
    "",
    secondPass
      ? "SECONDE PASSE : ce brouillon est une révision. Pour chaque problème de la passe précédente, dis s'il est corrigé (`previous_problems`, même index). Parmi les problèmes nouveaux, cherche UNIQUEMENT des fact_error, not_a_fact ou tone_negative : ne signale aucun nouvel overstatement, missing_caveat, translation_issue ou vague_title."
      : "PREMIÈRE PASSE : relève tous les problèmes.",
    "",
    "TYPES DE PROBLÈMES",
    "- fact_error : un fait, un chiffre, un nom ou un lien de causalité que l'article ne dit pas, ou contredit. Rejet définitif.",
    "  Un claim dont le fait de base est dans l'article mais qui ajoute un simple qualificatif (« mieux », « nombreux », « enfin ») reste `supported: true` : signale le qualificatif en overstatement, pas en fact_error.",
    "- overstatement : terme plus fort ou plus certain que la source (certitude pour un espoir, résultat pour un plan, généralisation). Un mot voisin plus parlant mais différent (« université de Washington » pour « Washington State University », « hémoglobine » pour « hème ») est une fact_error.",
    "- missing_caveat : une limite, opposition ou contrepartie importante de l'article est passée sous silence.",
    "- translation_issue : traduction qui ajoute une précision ou change le sens (« beetles » → « carabes »). RAPPEL : une traduction FIDÈLE d'un mot anglais n'est JAMAIS un translation_issue (« folly » → « insensé » est correct), même si le mot français n'apparaît pas dans l'article.",
    "- tone_negative : le résumé se lit globalement comme une mauvaise nouvelle. Rejet définitif.",
    "- vague_title : un lecteur ne comprend pas, avec le titre seul, ce qui s'est passé (« une vieille idée », « une découverte », « une avancée »). Propose un titre simple, en mots courants, sans nom propre ni terme technique.",
    "- not_a_fact : le résultat principal n'est qu'une possibilité et l'article ne décrit aucun résultat mesuré. Rejet définitif.",
    "- theme_mismatch : le thème principal ne correspond pas au sujet. Indique le thème correct dans `theme` (identifiant exact de la liste).",
    "",
    "Pour chaque problème, cite le passage fautif du brouillon tel quel et propose une correction concrète. Ne signale pas deux fois le même problème. Ne signale rien qui ne soit pas un problème.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "claims": [ { "index": 0, "supported": true, "note": "" } ],',
    '  "problems": [ { "type": "overstatement", "passage": "…", "correction": "…" }, { "type": "theme_mismatch", "passage": "…", "correction": "…", "theme": "science" } ],',
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

  const themeLines = context.theme
    ? [
        "",
        `THÈME PRINCIPAL ACTUEL : ${context.theme.current}`,
        `THÈMES DISPONIBLES : ${context.theme.available.map((t) => `"${t.id}" (${t.label})`).join(", ")}`,
      ]
    : [];

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
    ...themeLines,
    ...(secondPass ? ["", "PROBLÈMES DE LA PASSE PRÉCÉDENTE", previous] : []),
  ].join("\n");

  return { system, user };
}
