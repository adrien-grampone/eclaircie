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

/** Entrée de la pile de navigation (nom de route Expo Router, id de nouvelle s'il y en a un). */
export interface RouteEntry {
  name: string;
  id?: string | undefined;
}
const STORY_ROUTE = "story/[id]";

/** Vrai si la pile se termine par deux fois la même nouvelle (lien traité deux fois) : l'entrée du dessus est de trop. */
export function duplicateOnTop(routes: readonly RouteEntry[]): boolean {
  const top = routes[routes.length - 1];
  const below = routes[routes.length - 2];
  return !!top && !!below && top.name === STORY_ROUTE && below.name === STORY_ROUTE && top.id === below.id;
}

/**
 * Retour depuis l'écran Nouvelle : l'écran précédent s'il en existe un différent (Archives, Gardées,
 * Arrivée), sinon l'Arrivée du jour par remplacement (démarrage à froid par le widget : jamais un doublon).
 */
export function backHref(routes: readonly RouteEntry[]): "back" | "/" {
  const top = routes[routes.length - 1];
  const previous = routes.slice(0, -1).reverse().find((r) => !(r.name === STORY_ROUTE && r.id === top?.id));
  return previous ? "back" : "/";
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

/* ---------- URL de lancement : consommée une seule fois ---------- */

/** Fenêtre pendant laquelle une relivraison de l'URL de lancement (événement url) est ignorée. */
export const LAUNCH_URL_REPLAY_MS = 5000;

export interface LaunchGate {
  /** URL de lancement déjà consommée, avec l'instant de sa consommation. */
  consumed: { path: string; atMs: number } | null;
}

export const INITIAL_LAUNCH_GATE: LaunchGate = { consumed: null };

/**
 * Porte d'entrée des URL système (expo-router `redirectSystemPath`) : l'URL de lancement n'est suivie
 * qu'une fois par vie de l'app. Relue plus tard (iOS la garde toute la vie de l'app), elle mène à
 * l'Arrivée du jour ; rejouée en événement url juste après le lancement, elle est ignorée (null).
 * Les autres liens (retap du widget plus tard, notification) passent tels quels.
 */
export function gateSystemPath(gate: LaunchGate, incoming: { path: string; initial: boolean; atMs: number }): { gate: LaunchGate; path: string | null } {
  const { path, initial, atMs } = incoming;
  if (initial) {
    if (gate.consumed) return { gate, path: "/" };
    return { gate: { consumed: { path, atMs } }, path };
  }
  if (gate.consumed && gate.consumed.path === path && atMs - gate.consumed.atMs < LAUNCH_URL_REPLAY_MS) return { gate, path: null };
  return { gate, path };
}
