import type { PipelineConfig } from "./config.ts";
import { finalScore, impactScore, isNonHumanStudy } from "./impact.ts";
import { triageRejectReason, triageScore, type Triage, type TriageRejectReason } from "./triage.ts";

/** Identifiants de thèmes auxquels les règles éditoriales font référence (table `themes`). */
export const SCIENCE_THEME = "science";
export const HEALTH_THEME = "sante";
export const ANIMAL_THEME = "animaux";

/** Thèmes suivis et exception (pipeline_config) ; `themes: null` = tous les thèmes sont suivis. */
export interface FollowedThemes {
  themes: readonly string[] | null;
  exception: PipelineConfig["unfollowed_exception"];
}

export interface EditorialOutcome {
  /** Le triage avec ses thèmes corrigés (dédoublonnés, ordre conservé). */
  triage: Triage;
  reason: TriageRejectReason | null;
}

/**
 * Règles éditoriales appliquées EN CODE après le parsing, quoi que dise le modèle :
 * - un événement du calendrier (prix annuel, festival, sortie, classement) est rejeté ;
 * - une étude « tel aliment est bon pour… » est rejetée, quel que soit le thème ;
 * - une `discovery` n'est acceptée que pour le thème science ;
 * - une étude sur l'animal ou in vitro ne peut jamais porter le thème santé ;
 * - le premier thème est le thème principal (stories.theme_id).
 */
export function applyEditorialRules(triage: Triage, followed?: FollowedThemes): EditorialOutcome {
  const ruled = baseRules(triage);
  if (ruled.reason || !followed?.themes) return ruled;
  return followedRules(ruled.triage, followed.themes, followed.exception);
}

/**
 * Thèmes suivis : les thèmes non suivis sont retirés. Si le thème PRINCIPAL n'est pas suivi, l'article est
 * rejeté (`theme_not_followed`), sauf une percée ou une réalisation qui a DÉJÀ un effet concret sur des gens
 * (étude humaine ou hors étude, non préliminaire, `accomplished` ≥ seuil) : elle est rangée dans le premier
 * thème suivi de sa liste, sinon dans le thème de repli (Santé).
 */
function followedRules(triage: Triage, followed: readonly string[], exception: FollowedThemes["exception"]): EditorialOutcome {
  const kept = triage.themes.filter((t) => followed.includes(t));
  if (kept[0] === triage.themes[0]) return { triage: { ...triage, themes: kept }, reason: null };
  if (!isUnfollowedException(triage, exception)) return { triage: { ...triage, themes: kept }, reason: "theme_not_followed" };
  const themes = kept.length > 0 ? kept : followed.includes(exception.fallback_theme) ? [exception.fallback_theme] : [];
  if (themes.length === 0) return { triage: { ...triage, themes }, reason: "theme_not_followed" };
  return { triage: { ...triage, themes }, reason: null };
}

/** Une percée hors thèmes suivis, déjà utile à des gens : jamais une étude animale, in vitro, un prototype ou un « pourrait ». */
export function isUnfollowedException(triage: Triage, exception: FollowedThemes["exception"]): boolean {
  return (
    (triage.kind === "breakthrough" || triage.kind === "achievement") &&
    (triage.study_subject === "human" || triage.study_subject === "not_a_study") &&
    !triage.preliminary &&
    triage.accomplished >= exception.min_accomplished
  );
}

/** Notes du tri : score historique, impact, score final mélangé, et raison de rejet éventuelle. */
export interface TriageAssessment {
  base: number;
  impact: number;
  score: number;
  reason: TriageRejectReason | null;
}

type AssessConfig = Pick<PipelineConfig, "triage_weights" | "triage_min_score" | "impact_weights" | "impact_penalties" | "impact_mix" | "impact_min">;

/**
 * Règle de tri (validée le 2026-11-09) : éligible, score final = impact_mix × impact + (1 − impact_mix) ×
 * score historique ≥ triage_min_score, ET impact ≥ impact_min. À appeler sur un triage déjà passé par
 * applyEditorialRules (le thème principal compte pour la pénalité « étude non humaine »).
 */
export function assessTriage(triage: Triage, trustLevel: number, config: AssessConfig): TriageAssessment {
  const base = Math.round(triageScore(triage, trustLevel, config) * 100) / 100;
  const impact = impactScore(triage, isNonHumanStudy(triage.study_subject, mainTheme(triage), ANIMAL_THEME), config);
  const score = finalScore(impact, base, config);
  const reason = triageRejectReason(triage, score, config) ?? (impact < config.impact_min ? "low_impact" : null);
  return { base, impact, score, reason };
}

function baseRules(triage: Triage): EditorialOutcome {
  let themes = [...new Set(triage.themes)];

  if (triage.is_scheduled_event) return { triage: { ...triage, themes }, reason: "scheduled_event" };
  if (triage.is_food_health_claim) return { triage: { ...triage, themes }, reason: "food_health_claim" };

  const nonHuman = triage.study_subject === "animal" || triage.study_subject === "in_vitro";
  if (nonHuman && themes.includes(HEALTH_THEME)) {
    themes = themes.filter((t) => t !== HEALTH_THEME);
    if (themes.length === 0) return { triage: { ...triage, themes }, reason: "health_requires_human" };
  }

  if (triage.kind === "discovery") {
    if (!themes.includes(SCIENCE_THEME)) {
      return { triage: { ...triage, themes: [] }, reason: "discovery_outside_science" };
    }
    themes = [SCIENCE_THEME];
  }

  if (themes.length === 0) return { triage: { ...triage, themes }, reason: "no_theme" };
  return { triage: { ...triage, themes }, reason: null };
}

/** Le thème principal : le premier de la liste. */
export function mainTheme(triage: Pick<Triage, "themes">): string | null {
  return triage.themes[0] ?? null;
}
