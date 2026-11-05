import type { SplashOutcome } from "./splashStore.ts";

/**
 * Ouverture directe d'une nouvelle (widget, écran verrouillé, notification) : logique pure.
 * Le lien est `eclaircie://story/<id>`, l'id étant l'uuid de `stories` (même valeur que la RPC `daily_stories`).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStoryId(id: string | undefined): id is string {
  return typeof id === "string" && UUID.test(id);
}

/** Id de la nouvelle d'un lien profond, ou null si le lien n'en désigne pas une (schéma, chemin ou id invalides). */
export function storyIdFromUrl(url: string): string | null {
  const match = /^(?:eclaircie:\/\/|https?:\/\/[^/]+\/)(?:--\/)?story\/([^/?#]+)/i.exec(url.trim());
  const id = match?.[1];
  return id && isStoryId(id) ? id.toLowerCase() : null;
}

/** Où va l'app selon ce que la base répond pour cet id. Jamais un écran vide : sans nouvelle, l'Arrivée du jour. */
export type StoryOpen = { kind: "story" } | { kind: "redirect"; href: "/" } | { kind: "error"; message: string };

export function resolveStoryOpen(id: string | undefined, result: { story: unknown } | { error: string }): StoryOpen {
  if (!isStoryId(id)) return { kind: "redirect", href: "/" };
  if ("error" in result) return { kind: "error", message: result.error };
  return result.story ? { kind: "story" } : { kind: "redirect", href: "/" };
}

/** Retour depuis l'écran Nouvelle : l'écran précédent s'il existe (Archives, Gardées), sinon l'Arrivée du jour. */
export function backHref(canGoBack: boolean): "back" | "/" {
  return canGoBack ? "back" : "/";
}

/** Le splash ne tient jamais sa dernière image plus longtemps que ceci, quelle que soit la route. */
export const SPLASH_HOLD_MAX_MS = 2500;

/** Décision du splash en attente sur sa dernière image : finir, attendre encore, ou forcer le fondu. */
export function splashHoldAction(holdElapsedMs: number, outcome: SplashOutcome | null): "finish" | "wait" | "force" {
  if (outcome) return "finish";
  return holdElapsedMs >= SPLASH_HOLD_MAX_MS ? "force" : "wait";
}

/** Le splash animé ne se joue qu'au démarrage à froid ; app déjà ouverte + lien = navigation directe. */
export function splashPlays(coldStart: boolean): boolean {
  return coldStart;
}
