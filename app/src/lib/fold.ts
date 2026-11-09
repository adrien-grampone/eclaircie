/**
 * Double page sur écran pliable (iPhone Duo déplié), logique pure. La découpe vient d'`ArrangementView`
 * (Expo UI) : le système place ses deux panneaux de part et d'autre de la pliure ; l'app mesure leurs
 * cadres (coordonnées de la fenêtre) et en déduit deux pages et une gouttière. Tout autre cas (iPhone,
 * Duo plié, panneaux empilés) reste une page unique : le rendu habituel, inchangé.
 */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Span {
  x: number;
  width: number;
}

export type FoldLayout = { kind: "single" } | { kind: "spread"; left: Span; gutter: Span; right: Span };

export const SINGLE: FoldLayout = { kind: "single" };
/** En dessous, jamais de double page (les iPhone sont verrouillés en portrait, ≤ 440 pt). */
export const MIN_SPREAD_WIDTH = 600;
/** Largeur minimale de la gouttière, centrée sur la frontière entre les panneaux. */
export const MIN_GUTTER = 28;
/** Un panneau doit couvrir au moins cette part de la hauteur de la fenêtre (sinon : empilés). */
const MIN_PANE_HEIGHT_SHARE = 0.6;

/** Deux panneaux mesurés → double page, ou page unique s'ils ne sont pas côte à côte sur une fenêtre large. */
export function foldLayout(window: { width: number; height: number }, a: Frame | null, b: Frame | null): FoldLayout {
  if (!a || !b || window.width < MIN_SPREAD_WIDTH) return SINGLE;
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  const minHeight = window.height * MIN_PANE_HEIGHT_SHARE;
  if (left.width <= 0 || right.width <= 0 || left.height < minHeight || right.height < minHeight) return SINGLE;
  const leftEnd = left.x + left.width;
  if (right.x < leftEnd - 1) return SINGLE;
  const middle = (leftEnd + right.x) / 2;
  const gutterWidth = Math.max(MIN_GUTTER, right.x - leftEnd);
  const gutterX = middle - gutterWidth / 2;
  const rightX = gutterX + gutterWidth;
  if (gutterX <= 0 || rightX >= window.width) return SINGLE;
  return { kind: "spread", left: { x: 0, width: gutterX }, gutter: { x: gutterX, width: gutterWidth }, right: { x: rightX, width: window.width - rightX } };
}

/** Largeur de colonne de texte : ~65 caractères au corps 18 (DM Sans, ~0,48 em par caractère). */
export const READING_MAX_WIDTH = 560;

/** Éléments d'une grille sur deux pages, rangés par lignes : gauche, droite, gauche… */
export function pairRows<T>(items: readonly T[]): [T, T | null][] {
  const rows: [T, T | null][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push([items[i] as T, (items[i + 1] as T | undefined) ?? null]);
  return rows;
}
