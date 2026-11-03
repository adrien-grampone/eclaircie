import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import { parseJsonWith } from "./json.ts";
import type { Article, ParseResult, Prompt } from "./types.ts";

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
    why_good: z.string().trim().min(1),
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

export function buildDraftPrompt(
  article: Article,
  config: Pick<PipelineConfig, "summary_max_chars">,
): Prompt {
  const system = [
    "Tu rédiges la bonne nouvelle du jour pour une application française. Chaque matin, un lecteur reçoit UNE nouvelle vraie, vérifiée et sourcée, à lire en une minute.",
    "",
    "RÈGLES ABSOLUES",
    "- Tu rédiges UNIQUEMENT à partir du texte de l'article fourni. Rien d'autre : pas de connaissance extérieure, pas de contexte ajouté, pas de chiffre qui n'y figure pas.",
    "- Tu ne recopies JAMAIS le texte de l'article dans le résumé : tu reformules avec tes mots (droit d'auteur).",
    "- Tu n'exagères JAMAIS : « pourrait » ne devient pas « va », une étude sur la souris ne devient pas « un traitement », un objectif ne devient pas un résultat.",
    "- Chaque chiffre, date et nom propre du résumé doit figurer dans l'article.",
    "",
    "FORMAT",
    "- title_main + title_accent forment le titre en deux parties du design (title_accent est la chute, en italique). Exemple : « La couche d'ozone » / « se répare. »",
    `- summary : 2 à 3 phrases, ${config.summary_max_chars} caractères MAXIMUM, en français, tutoiement, ton chaleureux et précis.`,
    "- why_good : 1 phrase, pourquoi c'est une bonne nouvelle.",
    "- claims : chaque affirmation factuelle du résumé, avec en `evidence` la phrase EXACTE de l'article qui la soutient, recopiée mot pour mot (c'est la seule chose que tu recopies ; elle sera vérifiée par recherche dans le texte).",
    "- scene : description visuelle de la scène à illustrer, en anglais, sans texte ni visage en gros plan.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict de la forme :",
    "{",
    '  "title_main": "La couche d\'ozone",',
    '  "title_accent": "se répare.",',
    '  "summary": "…",',
    '  "why_good": "…",',
    '  "claims": [ { "claim": "…", "evidence": "…" } ],',
    '  "scene": "…"',
    "}",
  ].join("\n");

  const user = [
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

  return { system, user };
}
