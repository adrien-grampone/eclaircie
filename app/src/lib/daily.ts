import { themeOfTheDay } from "@pipeline/rotation.ts";
import { dateOfTimestamp } from "@pipeline/dates.ts";
import { titleLineHeight, titleTiers } from "@/theme/tokens.ts";
import type { Story } from "@/types.ts";

/**
 * Nouvelle du jour d'un utilisateur, logique pure (spec §2, rapport du 2026-11-04) :
 * le thème du jour vient de la rotation du pipeline (même règle, même code) ; la nouvelle est
 * celle de ce thème publiée aujourd'hui (l'app ne reçoit que des nouvelles validées). À défaut,
 * le thème suivant de l'utilisateur dans l'ordre de rotation qui a une nouvelle validée du jour ;
 * sinon story null : l'app affiche « Ta bonne nouvelle arrive bientôt ».
 */
export interface DailyPick {
  themeId: string;
  story: Story | null;
}

function todayOf(stories: readonly Story[], themeId: string, today: string): Story | null {
  return stories
    .filter((s) => s.theme_id === themeId && s.publish_date === today)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

export function selectDailyStory(
  userThemes: readonly string[],
  signupAt: string,
  today: string,
  stories: readonly Story[],
): DailyPick | null {
  const themeId = themeOfTheDay(userThemes, dateOfTimestamp(signupAt), today);
  if (!themeId) return null;
  const sorted = [...new Set(userThemes)].sort();
  const start = sorted.indexOf(themeId);
  for (let step = 0; step < sorted.length; step++) {
    const candidate = sorted[(start + step) % sorted.length];
    if (!candidate) continue;
    const story = todayOf(stories, candidate, today);
    if (story) return { themeId: candidate, story };
  }
  return { themeId, story: null };
}

/** « MARDI 3 NOVEMBRE » pour une date ISO, en français, sans l'année. */
export function formatDayLabel(isoDate: string, locale = "fr-FR"): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(date).toUpperCase();
}

/**
 * Nom du média seul, sans la rubrique que certains flux accolent après un tiret ou une barre
 * (« Phys.org — Biology » → « Phys.org », « Franceinfo — Culture » → « Franceinfo »).
 */
export function sourceLabel(sourceName: string): string {
  const [media] = sourceName.split(/\s+[—–|]\s+/);
  return (media ?? sourceName).trim() || sourceName.trim();
}

/** « VEN. 6 NOV. » : version courte de formatDayLabel, pour les colonnes étroites. */
export function formatShortDayLabel(isoDate: string, locale = "fr-FR"): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(date).toUpperCase();
}

/** « janvier 2023 » pour la date de la source ; vide sans date. */
export function formatSourceDate(isoDate: string | null, locale = "fr-FR"): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Temps de lecture en minutes, 1 minimum, à `wordsPerMinute` mots par minute. */
export function readingMinutes(text: string, wordsPerMinute = 200): number {
  const words = text.trim().split(/\s+/).filter((w) => w !== "").length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/** Taille et interlignage du titre selon sa longueur totale, d'après les paliers des tokens. */
export function titleSize(titleMain: string, titleAccent: string | null): { fontSize: number; lineHeight: number } {
  const total = titleMain.trim().length + (titleAccent ? titleAccent.trim().length + 1 : 0);
  const last = titleTiers[titleTiers.length - 1] as (typeof titleTiers)[number];
  const tier = titleTiers.find((t) => total <= t.maxChars) ?? last;
  return { fontSize: tier.fontSize, lineHeight: Math.round(tier.fontSize * titleLineHeight) };
}

/** Lignes mesurées d'un paragraphe (onTextLayout) : les `count` premières à côté de la lettrine, le reste après. */
export function splitMeasuredLines(lines: readonly { text: string }[], count = 2): { beside: string; rest: string } {
  const beside = lines.slice(0, count).map((l) => l.text).join("").replace(/\s+$/, "");
  const rest = lines.slice(count).map((l) => l.text).join("").replace(/\s+$/, "");
  return { beside, rest };
}
