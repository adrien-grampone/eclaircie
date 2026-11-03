import { daysBetween } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/**
 * Thème du jour d'un utilisateur (§2) :
 *   theme_du_jour = themes_choisis_tries[ jours_depuis_inscription % nb_themes ]
 *
 * Les thèmes sont dédoublonnés et triés par identifiant, pour que le résultat ne
 * dépende pas de l'ordre dans lequel l'utilisateur les a cochés. Un jour
 * antérieur à l'inscription compte comme le jour 0. Renvoie null sans thème.
 */
export function themeOfTheDay(
  userThemes: readonly string[],
  signupDate: IsoDate,
  day: IsoDate,
): string | null {
  const sorted = [...new Set(userThemes)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (sorted.length === 0) return null;
  const daysSinceSignup = Math.max(0, daysBetween(signupDate, day));
  return sorted[daysSinceSignup % sorted.length] ?? null;
}
