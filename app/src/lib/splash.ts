import { contrastRatio, mix, mixOklab } from "./color.ts";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Splash animé (démarrage à froid) : logique pure, en fractions `t` d'une ligne de temps de SPLASH_MS.
 * Nuit profonde, lever du soleil derrière la crête centrale, ciel qui passe par des étapes colorées
 * (jamais grises), mot « éclaircie » en fondu séquentiel, puis l'illustration du jour révélée en
 * cercle depuis le soleil.
 */
export const SPLASH_MS = 1600;
const at = (ms: number): number => ms / SPLASH_MS;

/** 0 → 0,5 s : nuit immobile. 0,3 → 1,2 s : lever. 0,5 → 1,1 s : le mot. 1,2 → 1,6 s : l'écran apparaît. */
export const SUNRISE = [at(300), at(1200)] as const;
export const WORD_IN = [at(500), at(700)] as const;
export const WORD_OUT = [at(900), at(1100)] as const;
/** Instant où l'on tient la dernière image tant que les données du jour ne sont pas là. */
export const HOLD_AT = at(1200);
/** Fondu de secours (image absente ou pas encore chargée) : la dernière image se fond dans l'arrivée. */
export const CROSSFADE_MS = 400;
/** Révélé circulaire de l'illustration depuis le soleil, puis fondu du contenu de l'arrivée. */
export const REVEAL_MS = 550;
/** Délai de grâce après HOLD_AT pour une illustration encore en chargement, avant le fondu de secours. */
export const IMAGE_GRACE_MS = 600;
/** Bord adouci du cercle : anneaux concentriques plus larges et plus transparents, du plus large au plus étroit. */
export const SOFT_EDGE = [{ extra: 16, opacity: 0.3 }, { extra: 8, opacity: 0.55 }] as const;
/** Fondu simple (« Réduire les animations », onboarding, écran Nouvelle direct). */
export const FADE_MS = 300;

/** Un ciel : couleur du haut et de l'horizon (plus chaude en bas). */
export interface SkyStage {
  top: string;
  horizon: string;
}
/** Étapes du lever : nuit profonde (vert-bleu), aube bleu-violet, rose poudré, puis la palette du thème. */
export const NIGHT: SkyStage = { top: "#0a1f2e", horizon: "#123d44" };
export const DAWN: SkyStage = { top: "#2a2f73", horizon: "#7a5fa8" };
export const PINK: SkyStage = { top: "#b382b8", horizon: "#f3b3a4" };
/** Chroma OKLab minimale de toute couleur et de tout milieu de fondu entre étapes. */
export const CHROMA_MIN = 0.03;
/** Silhouette des collines avant le lever. */
export const SILHOUETTE = "#071a1c";
export const SPLASH_COPY = { word: "éclaircie" } as const;
/** Palette de secours (Planète) quand le thème du jour n'est pas connu. */
export const PLANETE_PALETTE: Palette = {
  sky_top: "#EFB98A", sky_bottom: "#F4E5CC", sun: "#EE8F48", hill_light: "#B9D3B5", hill_mid: "#6FA48A", accent: "#2F6B5E",
};
/** Grain papier du splash, plus présent que sur les écrans (matière gouache). */
export const SPLASH_GRAIN = 0.14;
export const WORD_LIFT = 10;
/** Halo flou : taille (en diamètres de soleil) et opacité maximale. */
export const HALO = { size: 3.4, opacity: 0.55, scaleFrom: 0.45 } as const;
/** Soleil : part de la largeur de l'écran ; part du soleil qui reste derrière la crête à la fin. */
export const SUN_WIDTH_SHARE = 0.28;
const SUN_BEHIND_CREST = 0.3;
/** Marge sous la crête pour que le soleil soit vraiment caché au départ. */
const HIDE_MARGIN = 0.12;
/**
 * Trois plans de collines (masques PNG ondulés étirés à la largeur de l'écran, design/splash/make_masks.py) :
 * l'arrière monte depuis la gauche, le médian depuis la droite, l'avant est plus bas et plus large ; le
 * soleil se lève dans le creux. Hauteur en part de l'écran, et hauteur du bord au centre en part du masque
 * depuis le haut (imprimée par le script).
 */
export const HILL_PLANES = [
  { heightShare: 0.40, crestShare: 0.515 },
  { heightShare: 0.36, crestShare: 0.585 },
  { heightShare: 0.23, crestShare: 0.621 },
] as const;
/** Hauteur du mot (part de l'écran), pour lire la couleur du ciel derrière lui. */
export const WORD_Y_SHARE = 0.26;
/** Contraste minimal du mot contre le ciel, à chaque instant où il est visible. */
export const WORD_CONTRAST_MIN = 3;
/** Ombre très douce du mot crème. */
export const WORD_SHADOW = { color: "rgba(20,20,40,0.28)", radius: 8 } as const;

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

/** Ciel final : la palette du thème, l'horizon réchauffé d'un peu de soleil. */
export function themeStage(palette: Palette): SkyStage {
  return { top: palette.sky_top, horizon: mix(palette.sky_bottom, palette.sun, 0.25) };
}

export function skyStages(palette: Palette): SkyStage[] {
  return [NIGHT, DAWN, PINK, themeStage(palette)];
}

/**
 * Opacité de l'étape `index` (0 = nuit, toujours pleine) à l'avancement `rise` : chaque étape se fond
 * par-dessus la précédente, l'une après l'autre, sur un tiers du lever.
 */
export function stageOpacity(index: number, rise: number): number {
  "worklet";
  if (index === 0) return 1;
  return clamp01(rise * 3 - (index - 1));
}

/** Couleur effective d'un point du ciel à `rise`, top ou horizon (fondus empilés, en sRGB comme à l'écran). */
export function skyColorAt(stages: readonly SkyStage[], rise: number, key: keyof SkyStage): string {
  "worklet";
  let color = stages[0]?.[key] ?? "#000000";
  for (let i = 1; i < stages.length; i++) color = mix(color, stages[i]?.[key] ?? color, stageOpacity(i, rise));
  return color;
}

/** Ciel derrière le mot à l'avancement `rise`. */
export function skyBehindWord(stages: readonly SkyStage[], rise: number): string {
  "worklet";
  return mix(skyColorAt(stages, rise, "top"), skyColorAt(stages, rise, "horizon"), WORD_Y_SHARE);
}

/** Variante sombre du mot : l'accent du thème, assombri d'encre. */
export function wordDarkColor(palette: Palette, ink: string): string {
  return mixOklab(palette.accent, ink, 0.5);
}

/**
 * Part de la variante crème (0 → sombre, 1 → crème) selon celle qui contraste le mieux avec le ciel du
 * moment, avec une courte zone de fondu pour ne jamais sauter d'une couleur à l'autre.
 */
export function creamWeight(sky: string, dark: string, cream: string): number {
  "worklet";
  const diff = contrastRatio(cream, sky) - contrastRatio(dark, sky);
  return Math.min(1, Math.max(0, 0.5 + diff * 2));
}

/** Meilleur contraste disponible contre le ciel à cet instant (tests). */
export function wordContrast(sky: string, dark: string, cream: string): number {
  return Math.max(contrastRatio(cream, sky), contrastRatio(dark, sky));
}

/** Colline : de la silhouette à sa vraie couleur, en OKLab. */
export function hillColor(final: string, rise: number): string {
  "worklet";
  return mixOklab(SILHOUETTE, final, rise);
}

/** Géométrie du soleil à l'écran : centré, derrière la crête de la première colline. */
export interface SunLayout {
  size: number;
  cx: number;
  /** Centre final. */
  cy: number;
  crestY: number;
  /** Décalage vers le bas au départ (soleil entier sous la crête, avec marge). */
  hideOffset: number;
}

export function sunLayout(width: number, height: number): SunLayout {
  const size = width * SUN_WIDTH_SHARE;
  // La crête qui cache le soleil : le bord le plus haut des trois plans au centre de l'écran.
  const crestY = Math.min(...HILL_PLANES.map((plane) => height - height * plane.heightShare * (1 - plane.crestShare)));
  const cy = crestY - size * (0.5 - SUN_BEHIND_CREST);
  const hideOffset = crestY + size * HIDE_MARGIN - (cy - size / 2);
  return { size, cx: width / 2, cy, crestY, hideOffset };
}

/** translateY du soleil à `rise` : du décalage caché à sa position finale. */
export function sunTranslate(rise: number, hideOffset: number): number {
  "worklet";
  return hideOffset * (1 - rise);
}

/** Instant `t` où le centre du soleil franchit la crête (haptique), dans la fenêtre du lever. */
export function crestCrossingT(layout: SunLayout): number {
  const rise = clamp01(1 - (layout.crestY - layout.cy) / layout.hideOffset);
  const u = 1 - Math.cbrt(1 - rise);
  return SUNRISE[0] + u * (SUNRISE[1] - SUNRISE[0]);
}

/** Halo : absent la nuit, grandit et s'affirme avec le lever. */
export function haloOpacity(t: number): number {
  "worklet";
  return HALO.opacity * Math.sqrt(sunrise(t));
}

export function haloScale(t: number): number {
  "worklet";
  return HALO.scaleFrom + (1 - HALO.scaleFrom) * sunrise(t);
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

/** Diamètre du cercle qui couvre tout l'écran depuis (cx, cy) : deux fois la distance au coin le plus loin. */
export function revealDiameter(cx: number, cy: number, width: number, height: number): number {
  const dx = Math.max(cx, width - cx), dy = Math.max(cy, height - cy);
  return 2 * Math.hypot(dx, dy);
}

/**
 * Opacité du voile sur l'illustration dans l'iris : nulle au départ (l'image apparaît franche, pas grise),
 * pleine à la fin pour coïncider avec le voile de l'arrivée ; en accélération pour garder le début clair.
 */
export function veilOpacity(progress: number): number {
  "worklet";
  return clamp01(progress) ** 1.5;
}

/** Diamètre du cercle à `progress` (0 → 1) : du soleil à l'écran entier. */
export function revealSize(progress: number, sunRadius: number, full: number): number {
  "worklet";
  return 2 * sunRadius + (full - 2 * sunRadius) * clamp01(progress);
}
