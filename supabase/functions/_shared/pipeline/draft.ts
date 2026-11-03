import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import { parseJsonWith } from "./json.ts";
import type { Article, ParseResult, Prompt } from "./types.ts";
import type { VerifyProblem } from "./verify.ts";

/**
 * Étape `draft` (§4.4) — le rédacteur rédige à partir du texte complet UNIQUEMENT.
 * Les longueurs maximales (résumé, titre, chute) viennent de la config. Un dépassement de longueur
 * seul ne rejette pas : il déclenche une nouvelle tentative avec la consigne de raccourcir.
 */

/** Seuils de longueur du brouillon, lus dans pipeline_config. */
export type LengthConfig = Pick<PipelineConfig, "summary_max_chars" | "title_main_max_chars" | "title_accent_max_chars">;

const NO_LIMIT: LengthConfig = {
  summary_max_chars: Number.MAX_SAFE_INTEGER, title_main_max_chars: Number.MAX_SAFE_INTEGER, title_accent_max_chars: Number.MAX_SAFE_INTEGER,
};

export const ClaimSchema = z.object({
  claim: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
});

export function draftSchema(config: LengthConfig) {
  return z.object({
    title_main: z.string().trim().min(1).max(config.title_main_max_chars),
    title_accent: z.string().trim().max(config.title_accent_max_chars),
    summary: z.string().trim().min(1).max(config.summary_max_chars),
    claims: z.array(ClaimSchema).min(1),
    scene: z.string().trim().min(1),
  });
}

export type Draft = z.infer<ReturnType<typeof draftSchema>>;

/**
 * Sortie complète du rédacteur : soit un brouillon, soit le constat que la
 * contrepartie est trop forte pour en faire une bonne nouvelle.
 */
export function draftOutputSchema(config: LengthConfig) {
  return z.discriminatedUnion("verdict", [
    z.object({ verdict: z.literal("not_good_news"), reason: z.string().trim().min(1) }),
    draftSchema(config).extend({ verdict: z.literal("ok") }),
  ]);
}

export type DraftOutput = z.infer<ReturnType<typeof draftOutputSchema>>;

export function parseDraft(json: string, config: LengthConfig): ParseResult<DraftOutput> {
  return parseJsonWith(draftOutputSchema(config), json);
}

/** Un champ trop long dans une sortie par ailleurs valide. */
export interface LengthOverflow {
  field: "summary" | "title_main" | "title_accent";
  label: string;
  chars: number;
  max: number;
}

export function lengthOverflows(draft: Draft, config: LengthConfig): LengthOverflow[] {
  const checks: { field: LengthOverflow["field"]; label: string; max: number }[] = [
    { field: "summary", label: "le résumé", max: config.summary_max_chars },
    { field: "title_main", label: "le titre (title_main)", max: config.title_main_max_chars },
    { field: "title_accent", label: "la chute (title_accent)", max: config.title_accent_max_chars },
  ];
  return checks.filter((c) => draft[c.field].length > c.max).map((c) => ({ ...c, chars: draft[c.field].length }));
}

/** Issue d'une tentative de rédaction ou de révision, décidée en code (decideDraftOutput). */
export type ReviseStep =
  | { action: "accept"; draft: Draft }
  | { action: "not_good_news"; reason: string }
  | { action: "retry_shorter"; over: LengthOverflow[] }
  | { action: "reject"; reason: string };

/**
 * Une sortie dont SEULES des longueurs dépassent (résumé, titre, chute) mérite une tentative de
 * plus avec la consigne explicite de raccourcir, avant rejet. Toute autre erreur de parsing rejette.
 * `attempt` commence à 1 ; `revise_length_retries` vient de la config. `prefix` nomme l'étape dans les raisons.
 */
export function decideDraftOutput(
  json: string,
  attempt: number,
  config: LengthConfig & Pick<PipelineConfig, "revise_length_retries">,
  prefix: "draft" | "revise" = "revise",
): ReviseStep {
  const strict = parseDraft(json, config);
  if (strict.ok) {
    if (strict.value.verdict === "not_good_news") return { action: "not_good_news", reason: strict.value.reason };
    const { verdict: _verdict, ...draft } = strict.value;
    return { action: "accept", draft };
  }
  const lenient = parseJsonWith(draftOutputSchema(NO_LIMIT), json);
  if (lenient.ok && lenient.value.verdict === "ok") {
    const { verdict: _verdict, ...draft } = lenient.value;
    const over = lengthOverflows(draft, config);
    if (attempt <= config.revise_length_retries) return { action: "retry_shorter", over };
    const detail = over.map((o) => `${o.field} ${o.chars}/${o.max}`).join(", ");
    return { action: "reject", reason: `${prefix}_too_long: ${detail} après ${attempt} tentative(s)` };
  }
  return { action: "reject", reason: `${prefix}_parse_error: ${strict.error.slice(0, 200)}` };
}

/** Alias historique : décision de révision. */
export const decideRevise = decideDraftOutput;

/** Règles communes au brouillon et à sa révision : fidélité absolue à la source. */
export function draftRules(config: LengthConfig): string {
  return [
    "RÈGLES ABSOLUES",
    "- Tu rédiges UNIQUEMENT à partir du texte de l'article fourni. Rien d'autre : pas de connaissance extérieure, pas de contexte ajouté, pas de chiffre qui n'y figure pas.",
    "- Tu ne recopies JAMAIS le texte de l'article dans le résumé : tu reformules avec tes mots (droit d'auteur).",
    "- JAMAIS un terme plus fort ou plus certain que la source : un « could » reste « pourrait », un « plan » ou un « objectif » n'est pas un résultat, une « adoption » n'est pas une mise en œuvre, un espoir reste un espoir.",
    "- JAMAIS un terme plus précis que la source : « beetles » ne devient pas « carabes », « a study » ne devient pas « un essai clinique ». La traduction fidèle est autorisée et attendue ; l'ajout de précision ne l'est pas.",
    "- Chaque chiffre, date et nom propre du résumé doit figurer dans l'article, avec la même portée (une période reste une période, une espèce reste une espèce).",
    "- Noms d'espèces et de lieux : le nom français courant s'il existe (« méloé », « loris lent »), sinon une description (« un coléoptère rare »). JAMAIS un nom anglais brut dans le texte.",
    "",
    "TON : C'EST UNE BONNE NOUVELLE",
    "- Une nuance (limite, opposition, contrepartie) n'est mentionnée QUE si elle change le sens de CETTE nouvelle. Pas de contexte général négatif ajouté (« les effectifs déclinent ailleurs », « les menaces persistent »).",
    "- Quand elle s'impose : une demi-phrase maximum, jamais la dernière phrase, jamais dans le titre. Le résumé FINIT sur la bonne nouvelle.",
    "- Si la contrepartie est si forte qu'elle devrait figurer dans le titre, ce n'est pas une bonne nouvelle : réponds alors { \"verdict\": \"not_good_news\", \"reason\": \"…\" } et rien d'autre.",
    "",
    "FORMAT",
    "- verdict : \"ok\" quand tu livres un brouillon.",
    `- title_main + title_accent forment le titre en deux parties du design (title_accent est la chute, en italique). title_main : ${config.title_main_max_chars} caractères MAXIMUM ; title_accent : ${config.title_accent_max_chars} caractères MAXIMUM. Exemple : « La couche d'ozone » / « se répare. »`,
    "- Le titre est évocateur, c'est voulu ; il n'apporte aucun fait absent du résumé et ne le contredit pas.",
    `- summary : 2 à 3 phrases, ${config.summary_max_chars} caractères MAXIMUM, en français, tutoiement, ton chaleureux et précis.`,
    "- claims : chaque affirmation factuelle du résumé, avec en `evidence` la phrase EXACTE de l'article qui la soutient, recopiée mot pour mot (c'est la seule chose que tu recopies ; elle sera vérifiée par recherche dans le texte).",
    "- scene : description visuelle de la scène à illustrer, en anglais, pour un illustrateur qui n'a pas lu l'article. Règles :",
    "  · le sujet est EXACT (« three wind turbines », « a branching coral ») ou GÉNÉRIQUE (« a small farmland bird »), jamais approximatif (pas de « some kind of bird », pas d'espèce devinée) ;",
    "  · peu d'éléments : un sujet principal, un décor, au plus un détail secondaire ;",
    "  · les personnes sont de petites silhouettes au loin, sans visage ;",
    "  · aucun texte, aucune lettre, aucun logo, aucun panneau ni écran lisible dans la scène.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "verdict": "ok",',
    '  "title_main": "La couche d\'ozone",',
    '  "title_accent": "se répare.",',
    '  "summary": "…",',
    '  "claims": [ { "claim": "…", "evidence": "…" } ],',
    '  "scene": "…"',
    "}",
  ].join("\n");
}

function articleBlock(article: Article): string {
  return [
    `Source : ${article.sourceName}`,
    `URL : ${article.url}`,
    `Publié le : ${article.publishedAt ?? "(date inconnue)"}`,
    `Titre : ${article.title}`,
    "",
    "TEXTE DE L'ARTICLE",
    "<<<",
    article.fullText,
    ">>>",
  ].join("\n");
}

/** Consigne de longueur ajoutée au prompt quand la tentative précédente dépassait. */
export function shortenInstruction(over: readonly LengthOverflow[]): string[] {
  if (over.length === 0) return [];
  const items = over.map((o) => `${o.label} faisait ${o.chars} caractères, maximum ${o.max}`).join(" ; ");
  return ["", `CONSIGNE DE LONGUEUR : dans ta réponse précédente, ${items}. RACCOURCIS pour tenir sous ces maximums, sans rien ajouter, quitte à retirer un détail secondaire.`];
}

export interface DraftOptions {
  /** Champs trop longs de la tentative précédente. */
  shorten?: readonly LengthOverflow[];
}

export function buildDraftPrompt(article: Article, config: LengthConfig, options: DraftOptions = {}): Prompt {
  const system = [
    "Tu rédiges la bonne nouvelle du jour pour une application française. Chaque matin, un lecteur reçoit UNE nouvelle vraie, vérifiée et sourcée, à lire en une minute. Un relecteur sévère vérifiera chaque mot contre l'article : la moindre exagération fera rejeter ton texte.",
    "",
    draftRules(config),
  ].join("\n");
  return { system, user: [articleBlock(article), ...shortenInstruction(options.shorten ?? [])].join("\n") };
}

/**
 * Étape `revise` — le brouillon est réécrit avec les corrections du relecteur,
 * sans introduire de fait nouveau, puis repasse par verify.
 */
export type ReviseOptions = DraftOptions;

export function buildRevisePrompt(
  article: Article,
  draft: Draft,
  problems: readonly VerifyProblem[],
  config: LengthConfig,
  options: ReviseOptions = {},
): Prompt {
  const system = [
    "Tu révises la bonne nouvelle du jour d'une application française. Un relecteur a relevé des problèmes précis dans un brouillon. Corrige-les TOUS, en appliquant la correction proposée ou une formulation plus prudente, sans introduire aucun fait nouveau. Tout ce que le relecteur n'a pas signalé reste tel quel. Le texte corrigé doit toujours se lire comme une bonne nouvelle et finir sur elle.",
    "",
    draftRules(config),
  ].join("\n");
  const list = problems
    .map((p, i) => `${i + 1}. [${p.type}] passage : « ${p.passage} »\n   correction : ${p.correction}`)
    .join("\n");
  const shorten = shortenInstruction(options.shorten ?? []);
  const user = [
    articleBlock(article),
    "",
    "BROUILLON À RÉVISER",
    JSON.stringify(draft, null, 2),
    "",
    "PROBLÈMES RELEVÉS PAR LE RELECTEUR",
    list,
    ...shorten,
  ].join("\n");
  return { system, user };
}
