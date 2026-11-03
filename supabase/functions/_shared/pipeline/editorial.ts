import type { Triage, TriageRejectReason } from "./triage.ts";

/** Identifiants de thèmes auxquels les règles éditoriales font référence (table `themes`). */
export const SCIENCE_THEME = "science";
export const HEALTH_THEME = "sante";

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
export function applyEditorialRules(triage: Triage): EditorialOutcome {
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
