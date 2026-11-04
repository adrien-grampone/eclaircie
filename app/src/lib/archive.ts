import type { Story } from "@/types.ts";

/** Archives et Gardées (spec §8, écrans 6 et 7) : logique pure sur des listes de stories. */

export const ARCHIVE_PAGE_SIZE = 20;

export const ARCHIVE_COPY = {
  title: "Archives",
  alsoToday: "Aussi aujourd'hui",
  past: "Les jours passés",
  retracted: "Nouvelle retirée après vérification",
  empty: { title: "Rien à relire encore.", body: "Tes bonnes nouvelles passées se rangeront ici, jour après jour." },
  more: "Voir plus",
} as const;

export const SAVED_COPY = {
  title: "Gardées",
  empty: { title: "Rien de gardé pour l'instant.", body: "Touche le signet sur une nouvelle pour la retrouver ici." },
} as const;

export function isRetracted(story: Pick<Story, "status">): boolean {
  return story.status === "retracted";
}

/** Les nouvelles DU JOUR des autres thèmes de l'utilisateur, celle déjà affichée exclue, par thème trié. */
export function alsoToday(stories: readonly Story[], today: string, shownStoryId: string | null): Story[] {
  return stories
    .filter((s) => s.publish_date === today && s.id !== shownStoryId && !isRetracted(s))
    .sort((a, b) => a.theme_id.localeCompare(b.theme_id) || a.id.localeCompare(b.id));
}

/** Les jours passés (avant aujourd'hui), du plus récent au plus ancien, retirées comprises. */
export function pastEntries(stories: readonly Story[], today: string): Story[] {
  return stories
    .filter((s) => s.publish_date < today)
    .sort((a, b) => b.publish_date.localeCompare(a.publish_date) || a.theme_id.localeCompare(b.theme_id) || a.id.localeCompare(b.id));
}

/** Fenêtre de pagination : la page `page` (à partir de 0) et s'il en reste une. */
export function paginate<T>(items: readonly T[], page: number, size = ARCHIVE_PAGE_SIZE): { items: T[]; hasMore: boolean } {
  const end = (page + 1) * size;
  return { items: items.slice(0, end), hasMore: items.length > end };
}

/** Garder / retirer une story d'un ensemble d'identifiants (immuable). */
export function toggleSaved(saved: ReadonlySet<string>, storyId: string): Set<string> {
  const next = new Set(saved);
  if (next.has(storyId)) next.delete(storyId);
  else next.add(storyId);
  return next;
}
