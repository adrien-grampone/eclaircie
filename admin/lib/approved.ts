import type { StoryRow } from "./types.ts";

/** Textes de la page « Validées ». */
export const APPROVED_COPY = {
  intro: "stories dont le texte est validé, programmées ou non ; les plus proches de publication d'abord",
  published: "Déjà publiée : toute modification est visible immédiatement dans l'app.",
  unapprovePublished: "Annuler la validation d'une nouvelle publiée la retire de l'app jusqu'à une nouvelle validation.",
} as const;

/** Une story est publiée dès que son jour de publication est atteint. */
export function isPublished(story: Pick<StoryRow, "publish_date">, today: string): boolean {
  return story.publish_date !== null && story.publish_date <= today;
}

/**
 * Ordre d'affichage : à venir par date croissante (la plus proche d'abord), puis déjà publiées
 * de la plus récente à la plus ancienne, puis les non programmées (sans date) par score décroissant.
 */
export function orderApproved<T extends Pick<StoryRow, "publish_date" | "score">>(stories: readonly T[], today: string): T[] {
  const upcoming = stories.filter((s) => s.publish_date !== null && s.publish_date > today)
    .sort((a, b) => (a.publish_date as string).localeCompare(b.publish_date as string));
  const published = stories.filter((s) => isPublished(s, today))
    .sort((a, b) => (b.publish_date as string).localeCompare(a.publish_date as string));
  const unscheduled = stories.filter((s) => s.publish_date === null).sort((a, b) => b.score - a.score);
  return [...upcoming, ...published, ...unscheduled];
}
