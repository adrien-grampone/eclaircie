/**
 * Écran d'arrivée (spec §8, écran 3) : affiché à la PREMIÈRE ouverture de la journée.
 * `lastSeen` est la date (YYYY-MM-DD) de la dernière arrivée vue, gardée sur l'appareil.
 */
export const ARRIVAL_SEEN_KEY = "eclaircie.arrival_seen";
/** Drapeau : le rebond qui suggère le geste de tirage a déjà été montré (une seule fois, à la toute première arrivée). */
export const ARRIVAL_HINT_KEY = "eclaircie.arrival_hint_shown";

export function shouldShowArrival(lastSeen: string | null, today: string): boolean {
  return lastSeen !== today;
}

/** Textes de l'écran d'arrivée. */
export const ARRIVAL_COPY = {
  greeting: "Bonjour.",
  tagline: "Prends une minute pour toi.",
  cardMain: "Ta bonne nouvelle",
  cardAccent: "t'attend.",
  cta: "Découvrir",
} as const;
