import type { PipelineConfig } from "./config.ts";

/**
 * Score d'impact (test à blanc du 2026-11-09, reports/2026-11-09-contenu) : le tri note en plus ce qui
 * fait sourire — du concret, un fait déjà arrivé, proche de la vie des gens — et pénalise l'abstrait.
 * Il est mélangé au score de tri existant (impact_mix) et a son propre plancher (impact_min).
 */

/** Champs ajoutés à la réponse du tri (tous entre 0 et 1, sauf les deux drapeaux). */
export interface ImpactFields {
  concrete: number;
  accomplished: number;
  closeness: number;
  magnitude: number;
  before_after: number;
  preliminary: boolean;
  too_technical: boolean;
}

export const IMPACT_PROMPT = [
  "SCORE D'IMPACT",
  "L'application veut des nouvelles qui procurent un petit bonheur concret, pas des résultats abstraits. Évalue, de 0 à 1 :",
  "- `concrete` : on voit des gens, des animaux, des lieux réels (un village, une espèce nommée, des patients). 0 = molécule, algorithme, matériau, équation.",
  "- `accomplished` : c'est DÉJÀ arrivé dans le monde réel (une loi appliquée, des patients soignés, une forêt replantée, une invention déjà utilisée). 0 = « pourrait », « piste », « premiers résultats », « prototype », « ouvre la voie ».",
  "- `closeness` : proche de la vie des gens (santé courante, enfants, logement, nature près de chez soi, entraide). 0 = sujet que seul un spécialiste comprend.",
  "- `magnitude` : ampleur (nombre de personnes, surface, durée, pays).",
  "- `before_after` : un effet avant/après net et compréhensible (« il n'y avait plus aucun X, il y en a 300 »).",
  "Et deux drapeaux :",
  "- `preliminary` : vrai pour une étude in vitro, sur l'animal (sauf si le sujet EST l'animal, ex. des chiens soignés), une « piste », des « premiers résultats », un prototype de laboratoire.",
  "- `too_technical` : vrai si un lecteur de 15 ans ne comprendrait pas de quoi il s'agit sans explication longue.",
].join("\n");

export const IMPACT_JSON_EXAMPLE = [
  '  "concrete": 0.8,',
  '  "accomplished": 0.9,',
  '  "closeness": 0.6,',
  '  "magnitude": 0.5,',
  '  "before_after": 0.7,',
  '  "preliminary": false,',
  '  "too_technical": false,',
];

type ImpactConfig = Pick<PipelineConfig, "impact_weights" | "impact_penalties">;

/** Une étude sur l'animal ou in vitro, hors thème Animaux, est pénalisée. */
export function isNonHumanStudy(studySubject: string | null, mainTheme: string | null, animalTheme: string): boolean {
  return (studySubject === "animal" || studySubject === "in_vitro") && mainTheme !== animalTheme;
}

/** Impact entre 0 et 1 : somme pondérée des cinq critères, puis pénalités multiplicatives. Arrondi au centième. */
export function impactScore(impact: ImpactFields, nonHumanStudy: boolean, config: ImpactConfig): number {
  const w = config.impact_weights;
  const total = w.concrete + w.accomplished + w.closeness + w.magnitude + w.before_after;
  if (total === 0) return 0;
  let score = (w.concrete * impact.concrete + w.accomplished * impact.accomplished + w.closeness * impact.closeness
    + w.magnitude * impact.magnitude + w.before_after * impact.before_after) / total;
  if (nonHumanStudy) score *= config.impact_penalties.non_human_study;
  if (impact.preliminary) score *= config.impact_penalties.preliminary;
  if (impact.too_technical) score *= config.impact_penalties.too_technical;
  return Math.round(score * 100) / 100;
}

/** Score final : mélange de l'impact et du score de tri historique (positivité, importance, confiance). */
export function finalScore(impact: number, baseScore: number, config: Pick<PipelineConfig, "impact_mix">): number {
  return Math.round((config.impact_mix * impact + (1 - config.impact_mix) * baseScore) * 100) / 100;
}
