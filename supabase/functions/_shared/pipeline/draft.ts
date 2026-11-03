import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import { parseJsonWith } from "./json.ts";
import type { Article, ParseResult, Prompt } from "./types.ts";
import type { VerifyProblem } from "./verify.ts";

/**
 * Étape `draft` (§4.4) — Claude Sonnet rédige à partir du texte complet UNIQUEMENT.
 * La longueur maximale du résumé vient de `config.summary_max_chars`.
 */

export const ClaimSchema = z.object({
  claim: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
});

export function draftSchema(config: Pick<PipelineConfig, "summary_max_chars">) {
  return z.object({
    title_main: z.string().trim().min(1),
    title_accent: z.string().trim(),
    summary: z.string().trim().min(1).max(config.summary_max_chars),
    claims: z.array(ClaimSchema).min(1),
    scene: z.string().trim().min(1),
  });
}

export type Draft = z.infer<ReturnType<typeof draftSchema>>;

export function parseDraft(
  json: string,
  config: Pick<PipelineConfig, "summary_max_chars">,
): ParseResult<Draft> {
  return parseJsonWith(draftSchema(config), json);
}

/** Règles communes au brouillon et à sa révision : fidélité absolue à la source. */
export function draftRules(config: Pick<PipelineConfig, "summary_max_chars">): string {
  return [
    "RÈGLES ABSOLUES",
    "- Tu rédiges UNIQUEMENT à partir du texte de l'article fourni. Rien d'autre : pas de connaissance extérieure, pas de contexte ajouté, pas de chiffre qui n'y figure pas.",
    "- Tu ne recopies JAMAIS le texte de l'article dans le résumé : tu reformules avec tes mots (droit d'auteur).",
    "- JAMAIS un terme plus fort ou plus certain que la source : un « could » reste « pourrait », un « plan » ou un « objectif » n'est pas un résultat, une « adoption » n'est pas une mise en œuvre, un espoir reste un espoir.",
    "- JAMAIS un terme plus précis que la source : « beetles » ne devient pas « carabes », « a study » ne devient pas « un essai clinique ». La traduction fidèle est autorisée et attendue ; l'ajout de précision ne l'est pas.",
    "- Si l'article mentionne une limite, une opposition ou une contrepartie importante (déclin qui continue, zone réduite, projet inachevé, critiques), le résumé la mentionne honnêtement, en une demi-phrase.",
    "- Chaque chiffre, date et nom propre du résumé doit figurer dans l'article, avec la même portée (une période reste une période, une espèce reste une espèce).",
    "",
    "FORMAT",
    "- title_main + title_accent forment le titre en deux parties du design (title_accent est la chute, en italique). Exemple : « La couche d'ozone » / « se répare. »",
    "- title_accent peut être évocateur, mais n'apporte AUCUN fait absent du résumé et ne dit rien de plus fort que lui.",
    `- summary : 2 à 3 phrases, ${config.summary_max_chars} caractères MAXIMUM, en français, tutoiement, ton chaleureux et précis.`,
    "- claims : chaque affirmation factuelle du résumé, avec en `evidence` la phrase EXACTE de l'article qui la soutient, recopiée mot pour mot (c'est la seule chose que tu recopies ; elle sera vérifiée par recherche dans le texte).",
    "- scene : description visuelle de la scène à illustrer, en anglais, sans texte ni visage en gros plan.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
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

export function buildDraftPrompt(
  article: Article,
  config: Pick<PipelineConfig, "summary_max_chars">,
): Prompt {
  const system = [
    "Tu rédiges la bonne nouvelle du jour pour une application française. Chaque matin, un lecteur reçoit UNE nouvelle vraie, vérifiée et sourcée, à lire en une minute. Un relecteur sévère vérifiera chaque mot contre l'article : la moindre exagération fera rejeter ton texte.",
    "",
    draftRules(config),
  ].join("\n");
  return { system, user: articleBlock(article) };
}

/**
 * Étape `revise` — le brouillon est réécrit avec les corrections du relecteur,
 * sans introduire de fait nouveau, puis repasse par verify.
 */
export function buildRevisePrompt(
  article: Article,
  draft: Draft,
  problems: readonly VerifyProblem[],
  config: Pick<PipelineConfig, "summary_max_chars">,
): Prompt {
  const system = [
    "Tu révises la bonne nouvelle du jour d'une application française. Un relecteur a relevé des problèmes précis dans un brouillon. Corrige-les TOUS, en appliquant la correction proposée ou une formulation plus prudente encore, sans introduire aucun fait nouveau. Tout ce que le relecteur n'a pas signalé peut rester tel quel.",
    "",
    draftRules(config),
  ].join("\n");
  const list = problems
    .map((p, i) => `${i + 1}. [${p.type}] passage : « ${p.passage} »\n   correction : ${p.correction}`)
    .join("\n");
  const user = [
    articleBlock(article),
    "",
    "BROUILLON À RÉVISER",
    JSON.stringify(draft, null, 2),
    "",
    "PROBLÈMES RELEVÉS PAR LE RELECTEUR",
    list,
  ].join("\n");
  return { system, user };
}
