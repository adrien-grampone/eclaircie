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
  prefix: "draft" | "revise" | "rework" = "revise",
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
    "- PIÈGE DES GÉNÉRALISATIONS : rendre le texte concret ne veut jamais dire compléter l'article. Erreurs réelles, toutes rejetées par le relecteur : « Washington State University » devenue « l'université de Washington » (c'est une autre université) ; « un juge » devenu « une juge » ; « de l'hème » devenu « de l'hémoglobine » ; « une molécule liée au sang » devenue « des traces de sang ». Garde le mot exact de l'article ou un mot plus général, jamais un mot voisin plus parlant.",
    "",
    "CE QU'ON VEUT : UN PETIT BONHEUR QU'ON COMPREND DU PREMIER COUP",
    "Le lecteur a quinze secondes et aucune culture scientifique particulière. Il doit comprendre ce qui s'est passé, et sourire.",
    "- Si la contrepartie est si forte qu'elle devrait figurer dans le titre, ou si l'article ne raconte aucun fait réellement arrivé, ce n'est pas une bonne nouvelle : réponds { \"verdict\": \"not_good_news\", \"reason\": \"…\" } et rien d'autre.",
    "",
    "TITRE",
    "- verdict : \"ok\" quand tu livres un brouillon.",
    "- Le titre dit CE QUI S'EST PASSÉ, en mots simples, avec un sujet concret (qui ou quoi, et si possible où). Un adolescent de 15 ans le comprend sans aide.",
    "- Aucun jargon : pas de sigle, pas de nom de molécule, de gène ou de technique, pas de mot savant. Dis ce que ça fait, pas comment ça s'appelle. Un nom propre n'est utile que s'il parle au lecteur (un pays, une ville).",
    `- 12 mots maximum. title_main est le début de la phrase (en droit), title_accent la fin (en italique) : le sens prime sur l'effet de style. title_main : ${config.title_main_max_chars} caractères MAXIMUM ; title_accent : ${config.title_accent_max_chars} caractères MAXIMUM.`,
    "- Exemples du ton voulu : « Un policier australien » / « a donné son sang rare 545 fois. » — « À Flint, moins de bébés meurent » / « depuis une aide versée aux familles. »",
    "- Le titre se comprend SEUL, sans le résumé : on sait ce qui s'est passé, sans exiger de nom propre ni de terme technique. INTERDIT : une formulation vague ou allusive (« une vieille idée », « un donneur », « une découverte », « une avancée »).",
    "- Le titre n'apporte aucun fait absent du résumé et ne le contredit pas. Jamais de nuance, de « pourrait » ni de « piste » dans le titre.",
    "- Un résultat qui n'est qu'une possibilité (« pourrait mieux dépister ») n'est pas un résultat : si l'article mesure quelque chose, écris le fait mesuré ; sinon, verdict not_good_news.",
    "",
    "RÉSUMÉ EN TROIS TEMPS (tutoiement, chaleureux, phrases courtes)",
    "1. Le problème de départ, en une phrase concrète : ce qui n'allait pas, pour qui.",
    "2. Ce qui a changé : le fait, avec ses chiffres rendus parlants SANS rien ajouter (arrondi honnête, « un sur trois » pour 33 %, conversion d'unités ; jamais de comparaison absente de l'article).",
    "3. Pourquoi c'est une bonne nouvelle pour les gens (ou les animaux, la nature) : la conséquence concrète, telle que l'article la permet.",
    "- Nuance : une seule phrase courte, en toute fin, et QUE si elle change le sens de CETTE nouvelle (« Il faudra le confirmer sur plus de patients. »). Pas de contexte général négatif ajouté (« les effectifs déclinent ailleurs », « les menaces persistent »).",
    "- Le temps 3 reste dans ce que l'article permet : pas de « enfin », « mieux », « révolution » ni de promesse qu'il ne fait pas.",
    `- summary : ${config.summary_max_chars} caractères MAXIMUM, en français. Compte large : un résumé trop long est renvoyé.`,
    "",
    "FORMAT",
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
    "Tu révises la bonne nouvelle du jour d'une application française. Un relecteur a relevé des problèmes précis dans un brouillon. Corrige-les TOUS, en appliquant la correction proposée ou une formulation plus prudente, sans introduire aucun fait nouveau. Tout ce que le relecteur n'a pas signalé reste tel quel. Le texte corrigé doit toujours se lire comme une bonne nouvelle, sans autre nuance qu'une phrase courte en toute fin.",
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

/**
 * Reprise d'une ancienne nouvelle (statut `to_rework`) : le brouillon, écrit avec une consigne antérieure, est
 * réécrit selon la consigne actuelle, à partir du même article et sans fait nouveau. Il repasse ensuite par
 * la double vérification comme un nouveau brouillon.
 */
export function buildReworkPrompt(article: Article, draft: Draft, config: LengthConfig, options: ReviseOptions = {}): Prompt {
  const system = [
    "Tu reprends une bonne nouvelle déjà publiée par une application française, écrite avec une ancienne consigne. Réécris le titre et le résumé selon la consigne ci-dessous, à partir du texte de l'article UNIQUEMENT : aucun fait nouveau, rien qui ne figure dans l'article. Les claims et leurs evidence doivent correspondre au nouveau résumé. Si l'article ne permet pas d'écrire une bonne nouvelle selon cette consigne, réponds not_good_news.",
    "",
    draftRules(config),
  ].join("\n");
  const user = [articleBlock(article), "", "ANCIEN BROUILLON (à réécrire)", JSON.stringify(draft, null, 2), ...shortenInstruction(options.shorten ?? [])].join("\n");
  return { system, user };
}
