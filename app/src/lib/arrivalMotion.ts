import { SUN_DROP, SUN_ZOOM } from "./arrivalBackdrop.ts";
import { HILL, HILL_SHAPES, type SkyLayout } from "./skyLayout.ts";

/**
 * Géométrie de la transition Arrivée → Nouvelle, en pur : chaque calque est posé UNE fois à sa
 * taille finale, puis déplacé et mis à l'échelle (transform seulement, jamais de layout animé).
 * Les fonctions marquées `worklet` tournent sur le fil UI à chaque image.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Motion {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
}

/** Transform à appliquer à une vue posée en `final` pour qu'elle occupe `rect` (échelle autour du centre). */
export function rectMotion(final: Rect, rect: Rect): Motion {
  "worklet";
  return {
    translateX: rect.x + rect.w / 2 - (final.x + final.w / 2),
    translateY: rect.y + rect.h / 2 - (final.y + final.h / 2),
    scaleX: rect.w / final.w,
    scaleY: rect.h / final.h,
  };
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  "worklet";
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/** Style Reanimated d'un mouvement : la vue est à sa taille finale, déplacée puis mise à l'échelle. */
export function motionTransform(m: Motion): [{ translateX: number }, { translateY: number }, { scaleX: number }, { scaleY: number }] {
  "worklet";
  return [{ translateX: m.translateX }, { translateY: m.translateY }, { scaleX: m.scaleX }, { scaleY: m.scaleY }];
}

/* ---------- Fond : illustration ---------- */

/** Cadrage « cover » d'une image (ratio) dans un cadre, centré : le rectangle de l'image entière. */
export function coverRect(frame: { w: number; h: number }, image: { w: number; h: number }): Rect {
  const scale = Math.max(frame.w / image.w, frame.h / image.h);
  const w = image.w * scale;
  const h = image.h * scale;
  return { x: (frame.w - w) / 2, y: (frame.h - h) / 2, w, h };
}

/**
 * L'illustration est posée à son cadrage d'ARRIVÉE (cover plein écran) et rejoint son cadrage de la
 * Nouvelle (cover dans la zone d'illustration) par un seul mouvement uniforme.
 */
export function imageFrames(screen: { w: number; h: number }, imageHeight: number, image: { w: number; h: number }): { arrival: Rect; final: Rect } {
  return { arrival: coverRect(screen, image), final: coverRect({ w: screen.w, h: imageHeight }, image) };
}

/* ---------- Fond : ciel dessiné ---------- */

export type SkyPart = "gradient" | "sun" | "hill0" | "hill1" | "hill2";
export const SKY_PARTS: readonly SkyPart[] = ["gradient", "sun", "hill0", "hill1", "hill2"];

function percent(value: `${number}%` | number, total: number): number {
  return typeof value === "number" ? value : (parseFloat(value) / 100) * total;
}

/** Rectangles des éléments de `Sky` posés dans un cadre (mêmes règles que le composant). */
export function skyRects(layout: SkyLayout, frame: { w: number; h: number }): Record<SkyPart, Rect> {
  const size = layout.sun.size;
  const hill = (i: 0 | 1 | 2): Rect => ({ x: percent(HILL_SHAPES[i].left, frame.w), y: frame.h - layout.hills[i], w: percent(HILL_SHAPES[i].width, frame.w), h: HILL });
  return {
    gradient: { x: 0, y: 0, w: frame.w, h: frame.h },
    sun: { x: frame.w - percent(layout.sun.right, frame.w) - size, y: percent(layout.sun.top, frame.h), w: size, h: size },
    hill0: hill(0),
    hill1: hill(1),
    hill2: hill(2),
  };
}

/** Rectangle vu après le zoom d'arrivée (échelle SUN_ZOOM autour du centre de l'écran, puis descente SUN_DROP). */
export function arrivalZoom(rect: Rect, screen: { w: number; h: number }): Rect {
  const cx = screen.w / 2 + (rect.x + rect.w / 2 - screen.w / 2) * SUN_ZOOM;
  const cy = screen.h / 2 + (rect.y + rect.h / 2 - screen.h / 2) * SUN_ZOOM + screen.h * SUN_DROP;
  return { x: cx - (rect.w * SUN_ZOOM) / 2, y: cy - (rect.h * SUN_ZOOM) / 2, w: rect.w * SUN_ZOOM, h: rect.h * SUN_ZOOM };
}

/** Pour chaque élément du ciel : cadre final (zone d'illustration) et cadre d'arrivée (plein écran zoomé). */
export function skyFrames(layout: SkyLayout, screen: { w: number; h: number }, imageHeight: number): Record<SkyPart, { arrival: Rect; final: Rect }> {
  const finals = skyRects(layout, { w: screen.w, h: imageHeight });
  const fulls = skyRects(layout, screen);
  const out = {} as Record<SkyPart, { arrival: Rect; final: Rect }>;
  for (const part of SKY_PARTS) out[part] = { final: finals[part], arrival: arrivalZoom(fulls[part], screen) };
  return out;
}

/* ---------- Carte ---------- */

/** Part du trajet au bout de laquelle le bas de la carte est passé sous le bord de l'écran. */
export const BOTTOM_END = 0.2;

export interface CardGeometry {
  rest: Rect;
  final: Rect;
}

/** Carte au repos (verre, en bas de l'écran) et feuille finale (pleine largeur, dépassant du bas de `radius`). */
export function cardGeometry(screen: { w: number; h: number }, args: { insetBottom: number; margin: number; cardHeight: number; sheetTop: number; radius: number }): CardGeometry {
  const restBottom = screen.h - args.insetBottom - args.margin;
  return {
    rest: { x: args.margin, y: restBottom - args.cardHeight, w: screen.w - 2 * args.margin, h: args.cardHeight },
    final: { x: 0, y: args.sheetTop, w: screen.w, h: screen.h + args.radius - args.sheetTop },
  };
}

/** Rectangle de la carte à une progression : haut, côtés sur tout le trajet ; bas sous l'écran dès BOTTOM_END. */
export function cardRect(g: CardGeometry, progress: number): Rect {
  "worklet";
  const top = g.rest.y + (g.final.y - g.rest.y) * progress;
  const bottomT = Math.min(1, Math.max(0, progress / BOTTOM_END));
  const bottom = g.rest.y + g.rest.h + (g.final.y + g.final.h - g.rest.y - g.rest.h) * bottomT;
  return { x: g.rest.x + (g.final.x - g.rest.x) * progress, y: top, w: g.rest.w + (g.final.w - g.rest.w) * progress, h: bottom - top };
}

/** Pièces de la carte : calotte haute (coins arrondis), corps, calotte basse ; le corps chevauche les calottes de `overlap`. */
export function cardPieces(rect: Rect, radius: number, overlap: number): { top: Rect; body: Rect; bottom: Rect } {
  "worklet";
  return {
    top: { x: rect.x, y: rect.y, w: rect.w, h: radius },
    body: { x: rect.x, y: rect.y + radius - overlap, w: rect.w, h: rect.h - 2 * radius + 2 * overlap },
    bottom: { x: rect.x, y: rect.y + rect.h - radius, w: rect.w, h: radius },
  };
}
