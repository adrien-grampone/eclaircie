import { themeOfTheDay } from "@pipeline/rotation.ts";
import { dateOfTimestamp } from "@pipeline/dates.ts";
import { titleLineHeight, titleTiers } from "@/theme/tokens.ts";
import type { Story } from "@/types.ts";

/**
 * Nouvelle du jour d'un utilisateur, logique pure (spec §2) :
 * le thème du jour vient de la rotation du pipeline (même règle, même code) ;
 * la nouvelle est celle du thème publiée aujourd'hui, sinon la plus récente de ce thème,
 * sinon la plus récente des autres thèmes de l'utilisateur (dans l'ordre de rotation).
 */
export interface DailyPick {
  themeId: string;
  story: Story | null;
  /** true quand la nouvelle affichée n'est pas celle du jour (stock vide ce jour-là). */
  stale: boolean;
}

function latestOf(stories: readonly Story[], themeId: string, today: string): Story | null {
  return stories
    .filter((s) => s.theme_id === themeId && s.publish_date <= today)
    .sort((a, b) => b.publish_date.localeCompare(a.publish_date) || a.id.localeCompare(b.id))[0] ?? null;
}

export function selectDailyStory(
  userThemes: readonly string[],
  signupAt: string,
  today: string,
  stories: readonly Story[],
): DailyPick | null {
  const themeId = themeOfTheDay(userThemes, dateOfTimestamp(signupAt), today);
  if (!themeId) return null;
  const own = latestOf(stories, themeId, today);
  if (own) return { themeId, story: own, stale: own.publish_date !== today };
  const sorted = [...new Set(userThemes)].sort();
  for (const other of sorted) {
    if (other === themeId) continue;
    const story = latestOf(stories, other, today);
    if (story) return { themeId: other, story, stale: story.publish_date !== today };
  }
  return { themeId, story: null, stale: false };
}

/** « MARDI 3 NOVEMBRE » pour une date ISO, en français, sans l'année. */
export function formatDayLabel(isoDate: string, locale = "fr-FR"): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
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
