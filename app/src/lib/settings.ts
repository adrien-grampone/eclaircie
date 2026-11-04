import { nextTrigger } from "./onboarding.ts";

/** Réglages (spec §8, écran 8) : logique pure. */

export const SETTINGS_COPY = {
  title: "Réglages",
  themes: "Mes thèmes",
  time: "Heure du rendez-vous",
  method: "Comment on choisit les nouvelles",
  contact: "Nous écrire",
  saved: "Mes thèmes enregistrés.",
  timeSaved: (label: string) => `Rendez-vous déplacé à ${label}.`,
} as const;

/** Adresse de contact ; à confirmer avant publication. */
export const CONTACT_EMAIL = "contact@eclaircie.app";

export const METHOD_TEXT = [
  "Chaque nouvelle vient d'une source identifiée : institutions, revues scientifiques, médias de référence. Nous lisons leurs flux, pas les réseaux sociaux.",
  "Un premier tri automatique écarte ce qui n'est pas un fait daté et positif : opinions, promesses, communiqués, événements du calendrier.",
  "Un modèle d'IA rédige un résumé court, uniquement à partir du texte de l'article. Un second modèle, qui ne voit pas le premier, vérifie chaque affirmation contre la source et signale la moindre exagération.",
  "Rien n'est publié sans relecture humaine. Une nouvelle qui ne tient pas est retirée, et nous le disons.",
  "Nous ne republions jamais le texte des articles, et chaque nouvelle renvoie à sa source.",
] as const;

export interface NotifyTime {
  hour: number;
  minute: number;
}

export type ReschedulePlan =
  | { action: "none"; reason: "unchanged" | "not_granted" }
  | { action: "schedule"; hour: number; minute: number; next: Date };

/**
 * Changement d'heure dans les Réglages : reprogrammer SEULEMENT si l'heure change et que les
 * notifications sont autorisées ; sinon rien (le profil est tout de même enregistré).
 */
export function planReschedule(previous: NotifyTime, next: NotifyTime, granted: boolean, now: Date): ReschedulePlan {
  if (previous.hour === next.hour && previous.minute === next.minute) return { action: "none", reason: "unchanged" };
  if (!granted) return { action: "none", reason: "not_granted" };
  return { action: "schedule", hour: next.hour, minute: next.minute, next: nextTrigger(now, next.hour, next.minute) };
}
