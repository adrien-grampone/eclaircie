// Prompts EXPÉRIMENTAUX du test à blanc (non déployés) : tri avec score d'impact, rédaction « 3 temps ».
import { buildTriagePrompt, type TriageInput } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/triage.ts";
import type { Article, Prompt, ThemeRef } from "/Users/adriengrampone/Developer/perso/eclaircie/supabase/functions/_shared/pipeline/types.ts";

/** Longueurs proposées pour la nouvelle écriture (titre ~12 mots, résumé en 3 temps + nuance). */
export const NEW_LENGTHS = { title_main_max_chars: 40, title_accent_max_chars: 40, summary_max_chars: 480 } as const;

// ---------------------------------------------------------------- Tri : score d'impact

const IMPACT_BLOCK = [
  "",
  "SCORE D'IMPACT (en plus des champs ci-dessus)",
  "L'application veut des nouvelles qui procurent un petit bonheur concret, pas des résultats abstraits. Évalue, de 0 à 1 :",
  "- `concrete` : on voit des gens, des animaux, des lieux réels (un village, une espèce nommée, des patients). 0 = molécule, algorithme, matériau, équation.",
  "- `accomplished` : c'est DÉJÀ arrivé dans le monde réel (une loi appliquée, des patients soignés, une forêt replantée). 0 = « pourrait », « piste », « premiers résultats », « prototype », « ouvre la voie ».",
  "- `closeness` : proche de la vie des gens (santé courante, enfants, logement, nature près de chez soi, entraide). 0 = sujet que seul un spécialiste comprend.",
  "- `magnitude` : ampleur (nombre de personnes, surface, durée, pays).",
  "- `before_after` : un effet avant/après net et compréhensible (« il n'y avait plus aucun X, il y en a 300 »).",
  "Et deux drapeaux :",
  "- `preliminary` : vrai pour une étude in vitro, sur l'animal (sauf si le sujet EST l'animal, ex. des chiens soignés), une « piste », des « premiers résultats », un prototype de laboratoire.",
  "- `too_technical` : vrai si un lecteur de 15 ans ne comprendrait pas de quoi il s'agit sans explication longue.",
  "",
  "Ajoute ces sept champs au même objet JSON : \"concrete\", \"accomplished\", \"closeness\", \"magnitude\", \"before_after\", \"preliminary\", \"too_technical\".",
].join("\n");

export function buildImpactTriagePrompt(input: TriageInput, themes: readonly ThemeRef[]): Prompt {
  const base = buildTriagePrompt(input, themes);
  return { system: base.system + "\n" + IMPACT_BLOCK, user: base.user };
}

export interface Impact {
  concrete: number;
  accomplished: number;
  closeness: number;
  magnitude: number;
  before_after: number;
  preliminary: boolean;
  too_technical: boolean;
}

/** Pondérations et pénalités proposées (à mettre dans pipeline_config si on déploie). */
export const IMPACT = {
  weights: { concrete: 0.25, accomplished: 0.25, closeness: 0.2, magnitude: 0.15, before_after: 0.15 },
  penalty: { nonHumanStudy: 0.4, preliminary: 0.5, tooTechnical: 0.6 },
  /** Score final = mix × impact + (1 − mix) × score de tri actuel. */
  mix: 0.5,
  /** Seuil d'impact en dessous duquel une nouvelle est écartée même si le tri actuel l'accepte. */
  min: 0.5,
} as const;

export function impactScore(impact: Impact, studySubject: string | null, mainTheme: string | null): number {
  const w = IMPACT.weights;
  let s = w.concrete * impact.concrete + w.accomplished * impact.accomplished + w.closeness * impact.closeness
    + w.magnitude * impact.magnitude + w.before_after * impact.before_after;
  const nonHuman = (studySubject === "animal" || studySubject === "in_vitro") && mainTheme !== "animaux";
  if (nonHuman) s *= IMPACT.penalty.nonHumanStudy;
  if (impact.preliminary) s *= IMPACT.penalty.preliminary;
  if (impact.too_technical) s *= IMPACT.penalty.tooTechnical;
  return Math.round(s * 100) / 100;
}

// ---------------------------------------------------------------- Rédaction : nouvelle consigne

export function newDraftRules(): string {
  const L = NEW_LENGTHS;
  return [
    "RÈGLES ABSOLUES (inchangées)",
    "- Tu rédiges UNIQUEMENT à partir du texte de l'article fourni : aucune connaissance extérieure, aucun chiffre ni comparaison qui n'y figure pas.",
    "- Tu reformules avec tes mots, tu ne recopies jamais l'article dans le résumé.",
    "- JAMAIS plus fort ni plus précis que la source : un « could » reste « pourrait », un objectif n'est pas un résultat.",
    "- Chaque chiffre, date et nom propre du résumé figure dans l'article. Noms d'espèces et de lieux en français courant, sinon une description.",
    "",
    "CE QU'ON VEUT : UN PETIT BONHEUR QU'ON COMPREND DU PREMIER COUP",
    "Le lecteur a quinze secondes, pas de culture scientifique particulière. Il doit comprendre ce qui s'est passé et sourire.",
    "",
    "TITRE",
    "- Il dit CE QUI S'EST PASSÉ, en mots simples, avec un sujet concret (qui ou quoi, et si possible où). Un ado de 15 ans le comprend sans aide.",
    "- Aucun jargon : pas de sigle, pas de nom de molécule, de gène ou de technique, pas de mot savant. Dis ce que ça fait, pas comment ça s'appelle.",
    `- 12 mots maximum au total. title_main est le début de la phrase (en droit), title_accent la fin (en italique) : le sens prime sur l'effet de style. title_main ${L.title_main_max_chars} caractères max, title_accent ${L.title_accent_max_chars} max.`,
    "- Exemples du ton voulu : « Au Kenya, » / « les éléphants reviennent dans une forêt rendue aux villages. » — « Des chiens hémophiles » / « soignés grâce à des plaquettes qui durent trois semaines. »",
    "- Jamais de nuance, de « pourrait » ni de « piste » dans le titre.",
    "",
    "RÉSUMÉ EN TROIS TEMPS (tutoiement, chaleureux, phrases courtes)",
    "1. Le problème de départ, en une phrase concrète : ce qui n'allait pas, pour qui.",
    "2. Ce qui a changé : le fait, avec ses chiffres rendus parlants SANS rien ajouter (arrondis honnêtes, « un sur trois » pour 33 %, conversion d'unités ; jamais de comparaison absente de l'article).",
    "3. Pourquoi c'est une bonne nouvelle pour les gens (ou les animaux, la nature) : la conséquence concrète, telle que l'article la permet.",
    "- Nuance : UNE seule phrase courte en toute fin, seulement si elle change le sens (ex. « Il faudra le confirmer sur plus de patients. »). Sinon, aucune.",
    `- ${L.summary_max_chars} caractères maximum.`,
    "- Si l'article ne permet pas d'écrire le temps 2 avec un fait réellement arrivé, réponds { \"verdict\": \"not_good_news\", \"reason\": \"…\" }.",
    "",
    "FORMAT (inchangé)",
    "- claims : chaque affirmation factuelle du résumé, avec en `evidence` la phrase EXACTE de l'article qui la soutient.",
    "- scene : description visuelle en anglais pour l'illustrateur (sujet exact ou générique, peu d'éléments, personnes en silhouettes lointaines, aucun texte).",
    "Réponds UNIQUEMENT avec un objet JSON strict :",
    '{ "verdict": "ok", "title_main": "…", "title_accent": "…", "summary": "…", "claims": [ { "claim": "…", "evidence": "…" } ], "scene": "…" }',
  ].join("\n");
}

export function buildNewDraftPrompt(article: Article): Prompt {
  const system = [
    "Tu rédiges la bonne nouvelle du jour pour une application française : chaque matin, UNE nouvelle vraie, vérifiée et sourcée, à lire en une minute. Un relecteur sévère vérifiera chaque mot contre l'article.",
    "",
    newDraftRules(),
  ].join("\n");
  const user = [
    `Source : ${article.sourceName}`, `URL : ${article.url}`, `Publié le : ${article.publishedAt ?? "(date inconnue)"}`, `Titre : ${article.title}`,
    "", "TEXTE DE L'ARTICLE", "<<<", article.fullText, ">>>",
  ].join("\n");
  return { system, user };
}

/** Révision avec la nouvelle consigne : mêmes règles, corrections du relecteur appliquées sans fait nouveau. */
export function buildNewRevisePrompt(article: Article, draft: object, problems: readonly { type: string; passage: string; correction: string }[]): Prompt {
  const system = [
    "Tu révises la bonne nouvelle du jour d'une application française. Un relecteur a relevé des problèmes précis. Corrige-les TOUS, en appliquant la correction proposée ou une formulation plus prudente, sans introduire aucun fait nouveau. Le reste ne bouge pas, et le texte garde sa simplicité et sa chaleur.",
    "",
    newDraftRules(),
  ].join("\n");
  const list = problems.map((p, i) => `${i + 1}. [${p.type}] passage : « ${p.passage} »\n   correction : ${p.correction}`).join("\n");
  const user = [
    `Source : ${article.sourceName}`, `URL : ${article.url}`, `Titre : ${article.title}`, "", "TEXTE DE L'ARTICLE", "<<<", article.fullText, ">>>",
    "", "BROUILLON À RÉVISER", JSON.stringify(draft, null, 2), "", "PROBLÈMES RELEVÉS PAR LE RELECTEUR", list,
  ].join("\n");
  return { system, user };
}
