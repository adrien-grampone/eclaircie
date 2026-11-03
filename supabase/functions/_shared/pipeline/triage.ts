import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import { parseJsonWith } from "./json.ts";
import type { ParseResult, Prompt, ThemeRef } from "./types.ts";

/**
 * Étape `triage` (§4.2) — Claude Haiku lit titre + extrait RSS + source et
 * renvoie ce JSON. `evergreen` est marqué ici pour la programmation (§4.9).
 */
export const TriageSchema = z.object({
  is_good_news: z.boolean(),
  themes: z.array(z.string().min(1)),
  is_fact: z.boolean(),
  is_promotional: z.boolean(),
  positivity: z.number().min(0).max(1),
  significance: z.number().min(0).max(1),
  evergreen: z.boolean().default(false),
  reason: z.string(),
});

export type Triage = z.infer<typeof TriageSchema>;

/** Borne haute de `sources.trust_level` (contrainte `check (between 1 and 3)` du schéma). */
export const MAX_TRUST_LEVEL = 3;

export interface TriageInput {
  title: string;
  snippet: string | null;
  sourceName: string;
}

export function parseTriage(json: string): ParseResult<Triage> {
  return parseJsonWith(TriageSchema, json);
}

/**
 * score = w.positivity × positivity + w.significance × significance + w.trust × (trust_level / 3)
 * Les pondérations viennent de `config.triage_weights`.
 */
export function triageScore(
  triage: Pick<Triage, "positivity" | "significance">,
  trustLevel: number,
  config: Pick<PipelineConfig, "triage_weights">,
): number {
  const { positivity, significance, trust } = config.triage_weights;
  const boundedTrust = Math.min(MAX_TRUST_LEVEL, Math.max(0, trustLevel));
  return (
    positivity * triage.positivity +
    significance * triage.significance +
    trust * (boundedTrust / MAX_TRUST_LEVEL)
  );
}

/**
 * On garde si c'est une bonne nouvelle factuelle, non publicitaire, au-dessus
 * du seuil, et rattachée à au moins un thème (une story sans thème n'a pas de
 * place dans l'app).
 */
export function isTriageAccepted(
  triage: Triage,
  score: number,
  config: Pick<PipelineConfig, "triage_min_score">,
): boolean {
  return (
    triage.is_good_news &&
    triage.is_fact &&
    !triage.is_promotional &&
    triage.themes.length > 0 &&
    score >= config.triage_min_score
  );
}

export function buildTriagePrompt(input: TriageInput, themes: readonly ThemeRef[]): Prompt {
  const themeList = themes.map((t) => `- "${t.id}" : ${t.label}`).join("\n");
  const system = [
    "Tu tries des articles de presse pour une application qui publie chaque matin UNE bonne nouvelle vraie, vérifiée et sourcée.",
    "",
    "Une nouvelle est éligible seulement si TOUTES ces conditions sont vraies :",
    "- c'est un FAIT daté : une découverte, un résultat mesuré, une décision actée, un projet achevé. Pas une opinion, pas une promesse, pas un « pourrait » ;",
    "- elle est positive SANS contrepartie cachée : pas de « bonne nouvelle pour X » qui est une mauvaise nouvelle pour Y ;",
    "- elle n'est PAS publicitaire : pas de lancement de produit, pas de communiqué de marque.",
    "",
    "Thèmes possibles (utilise uniquement ces identifiants) :",
    themeList,
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict, sans commentaire, de la forme :",
    "{",
    '  "is_good_news": true,',
    '  "themes": ["planete"],',
    '  "is_fact": true,',
    '  "is_promotional": false,',
    '  "positivity": 0.9,',
    '  "significance": 0.8,',
    '  "evergreen": false,',
    '  "reason": "courte justification en français"',
    "}",
    "",
    "positivity et significance sont des nombres entre 0 et 1.",
    "evergreen vaut true si la nouvelle restera vraie et intéressante dans plusieurs mois (une découverte, un résultat durable), false si elle est liée à l'actualité immédiate.",
  ].join("\n");

  const user = [
    `Source : ${input.sourceName}`,
    `Titre : ${input.title}`,
    `Extrait : ${input.snippet ?? "(aucun extrait)"}`,
  ].join("\n");

  return { system, user };
}
