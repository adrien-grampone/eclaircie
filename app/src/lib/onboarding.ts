/** Onboarding (spec §8, écrans 1 et 2) : logique pure, sans React ni Supabase. */

export interface OnboardingTheme {
  id: string;
  label: string;
  active: boolean;
  coming_soon: boolean;
}

export const ONBOARDING_COPY = {
  welcome: "BIENVENUE SUR ÉCLAIRCIE",
  titleMain: "Quelles bonnes nouvelles",
  titleAccent: "te font du bien ?",
  promise: ["Chaque matin, tu reçois ", "une bonne nouvelle vérifiée et sourcée", " sur les thèmes que tu choisis."] as const,
  soon: "bientôt",
  timeCaption: "TON RENDEZ-VOUS",
  timeMain: "À quelle heure veux-tu",
  timeAccent: "ta bonne nouvelle ?",
  timeHelp: "Une seule notification par jour, à l'heure que tu choisis. Tu pourras la changer dans les réglages.",
  timeCta: "C'est noté",
} as const;

/** Heure par défaut du rendez-vous (spec §8) et pas des minutes du sélecteur. */
export const DEFAULT_NOTIFY = { hour: 8, minute: 0 } as const;
export const MINUTE_STEP = 15;

/** Un thème est sélectionnable s'il est actif et pas « bientôt ». */
export function isSelectable(theme: OnboardingTheme): boolean {
  return theme.active && !theme.coming_soon;
}

/** Ajoute ou retire un thème de la sélection ; un thème non sélectionnable est ignoré. */
export function toggleTheme(selected: readonly string[], theme: OnboardingTheme): string[] {
  if (!isSelectable(theme)) return [...selected];
  return selected.includes(theme.id) ? selected.filter((id) => id !== theme.id) : [...selected, theme.id];
}

/** « Continuer · 3 thèmes », « Continuer · 1 thème », « Continuer » à zéro. */
export function continueLabel(count: number): string {
  if (count <= 0) return "Continuer";
  return `Continuer · ${count} thème${count > 1 ? "s" : ""}`;
}

/** « 8 h 00 » pour l'affichage. */
export function formatHour(hour: number, minute: number): string {
  return `${hour} h ${String(minute).padStart(2, "0")}`;
}

/** Heure au format `time` Postgres (« 08:00:00 ») et retour. */
export function toNotifyTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function parseNotifyTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return { ...DEFAULT_NOTIFY };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export interface ProfileInput {
  themes: readonly string[];
  hour: number;
  minute: number;
  timezone: string;
}

export type ProfileValidation =
  | { ok: true; row: { themes: string[]; notify_time: string; timezone: string } }
  | { ok: false; reason: string };

/** Vérifie et met en forme le profil avant écriture : thèmes connus et sélectionnables, heure valide, fuseau non vide. */
export function validateProfile(input: ProfileInput, themes: readonly OnboardingTheme[]): ProfileValidation {
  const unique = [...new Set(input.themes)];
  if (unique.length === 0) return { ok: false, reason: "aucun thème choisi" };
  const unknown = unique.find((id) => !themes.some((t) => t.id === id && isSelectable(t)));
  if (unknown) return { ok: false, reason: `thème inconnu ou indisponible : ${unknown}` };
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) return { ok: false, reason: "heure invalide" };
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) return { ok: false, reason: "minute invalide" };
  if (input.timezone.trim() === "") return { ok: false, reason: "fuseau horaire manquant" };
  return { ok: true, row: { themes: unique, notify_time: toNotifyTime(input.hour, input.minute), timezone: input.timezone } };
}

/**
 * Prochain déclenchement d'une notification quotidienne à `hour:minute`, heure locale de `now` :
 * aujourd'hui si l'heure n'est pas encore passée, sinon demain.
 */
export function nextTrigger(now: Date, hour: number, minute: number): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
