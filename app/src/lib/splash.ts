import { VEIL_ACCENT, VEIL_INK } from "./arrivalBackdrop.ts";
import { mix, mixOklab } from "./color.ts";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Splash animé (démarrage à froid) : logique pure, en fractions `t` d'une ligne de temps de SPLASH_MS.
 * Nuit profonde, lever du soleil derrière les collines, ciel interpolé en OKLab vers la palette du
 * thème, mot « éclaircie » en fondu séquentiel, puis la dernière image coïncide avec le fond de
 * l'écran « Arrivée du jour » (ciel dessiné, voilé) et l'écran apparaît par-dessus.
 */
export const SPLASH_MS = 1600;
const at = (ms: number): number => ms / SPLASH_MS;

/** 0 → 0,5 s : nuit immobile. 0,3 → 1,2 s : lever. 0,5 → 1,1 s : le mot. 1,2 → 1,6 s : l'écran apparaît. */
export const SUNRISE = [at(300), at(1200)] as const;
export const WORD_IN = [at(500), at(700)] as const;
export const WORD_OUT = [at(900), at(1100)] as const;
/** Instant où l'on tient la dernière image tant que les données du jour ne sont pas là. */
export const HOLD_AT = at(1200);
export const REVEAL_MS = 400;
/** Fondu simple (« Réduire les animations », onboarding, écran Nouvelle direct). */
export const FADE_MS = 300;

/** Nuit/aube : la couleur du haut est aussi l'aplat du splash natif (app.json). */
export const NIGHT = { top: "#0e2620", bottom: "#1e443b" } as const;
/** Silhouette des collines avant le lever. */
export const SILHOUETTE = "#0b1d18";
export const SPLASH_COPY = { word: "éclaircie" } as const;
/** Palette de secours (Planète) quand le thème du jour n'est pas connu. */
export const PLANETE_PALETTE: Palette = {
  sky_top: "#EFB98A", sky_bottom: "#F4E5CC", sun: "#EE8F48", hill_light: "#B9D3B5", hill_mid: "#6FA48A", accent: "#2F6B5E",
};
export const BANDS = 24;
/**
 * Collines du splash (hauteur depuis le bas du cadre, claire/moyenne/accent) : plus hautes que celles
 * de Sky, car le cadre agrandi de l'arrivée pousse les siennes hors de l'écran. Le soleil, lui, garde
 * exactement la position de l'arrivée ; les collines n'appartiennent qu'au splash.
 */
export const SPLASH_HILLS: [number, number, number] = [420, 350, 280];
export const WORD_LIFT = 10;
export const HALO = { scale: 2.2, opacity: 0.28 } as const;
/** Marge sous la crête pour que le soleil soit vraiment caché au départ (la calotte est plus basse à droite). */
const HIDE_MARGIN = 0.25;

function clamp01(x: number): number {
  "worklet";
  return Math.min(1, Math.max(0, x));
}

function segment(t: number, [from, to]: readonly [number, number]): number {
  "worklet";
  return clamp01((t - from) / (to - from));
}

/** Avancement du lever (0 → 1), Easing.out(cubic) sur la fenêtre SUNRISE. */
export function sunrise(t: number): number {
  "worklet";
  const u = segment(t, SUNRISE);
  return 1 - (1 - u) ** 3;
}

/** Couleur finale d'une bande du ciel à l'arrivée : dégradé du thème sous le voile (accent puis encre). */
export function arrivalBand(i: number, palette: Palette, ink: string): string {
  "worklet";
  return mix(mix(mix(palette.sky_top, palette.sky_bottom, i / (BANDS - 1)), palette.accent, VEIL_ACCENT), ink, VEIL_INK);
}

export function nightBand(i: number): string {
  "worklet";
  return mix(NIGHT.top, NIGHT.bottom, i / (BANDS - 1));
}

/** Bande du ciel pendant le lever : de la nuit à l'arrivée, en OKLab. */
export function skyBand(i: number, palette: Palette, ink: string, rise: number): string {
  "worklet";
  return mixOklab(nightBand(i), arrivalBand(i, palette, ink), rise);
}

/** Colline : de la silhouette à sa vraie couleur, en OKLab. */
export function hillColor(final: string, rise: number): string {
  "worklet";
  return mixOklab(SILHOUETTE, final, rise);
}

/** Géométrie du soleil dans le cadre du ciel (hauteur `height`) : haut final, taille, crête de la première colline. */
export interface SunGeometry {
  sunTop: number;
  sunSize: number;
  crest: number;
}

export function sunGeometry(height: number, sunTopShare: number, sunSize: number, hillRise: number): SunGeometry {
  return { sunTop: sunTopShare * height, sunSize, crest: height - hillRise };
}

/** Décalage vers le bas au départ : le soleil entier sous la crête, avec marge. */
export function sunHideOffset(g: SunGeometry): number {
  return Math.max(0, g.crest - g.sunTop + g.sunSize * HIDE_MARGIN);
}

/** translateY du soleil à `rise` : du décalage caché à sa position d'arrivée. */
export function sunTranslate(rise: number, hideOffset: number): number {
  "worklet";
  return hideOffset * (1 - rise);
}

/** Instant `t` où le centre du soleil franchit la crête (haptique), dans la fenêtre du lever. */
export function crestCrossingT(g: SunGeometry): number {
  const offset = sunHideOffset(g);
  if (offset === 0) return SUNRISE[0];
  const centreAtRest = g.sunTop + g.sunSize / 2;
  const rise = clamp01(1 - (g.crest - centreAtRest) / offset);
  const u = 1 - Math.cbrt(1 - rise);
  return SUNRISE[0] + u * (SUNRISE[1] - SUNRISE[0]);
}

export function haloOpacity(t: number): number {
  "worklet";
  const r = sunrise(t);
  return HALO.opacity * Math.sin(r * Math.PI);
}

export function haloScale(t: number): number {
  "worklet";
  return 1 + (HALO.scale - 1) * sunrise(t);
}

/** Le mot : fondu entrant puis sortant, sans chevaucher l'écran qui apparaît après HOLD_AT. */
export function wordOpacity(t: number): number {
  "worklet";
  return segment(t, WORD_IN) - segment(t, WORD_OUT);
}

export function wordTranslate(t: number): number {
  "worklet";
  return WORD_LIFT * (1 - segment(t, WORD_IN)) - WORD_LIFT * segment(t, WORD_OUT);
}

/** Opacité du splash posé sur l'écran : pleine jusqu'à HOLD_AT, puis l'écran apparaît en fondu. */
export function overlayOpacity(t: number): number {
  "worklet";
  return 1 - segment(t, [HOLD_AT, 1]);
}
