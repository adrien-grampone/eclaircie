/**
 * Couleurs calculées en pur (hex à 6 chiffres), sans dépendance. Les fonctions marquées `worklet`
 * sont appelables depuis le fil UI (styles animés de Reanimated).
 */

function channels(hex: string): [number, number, number] {
  "worklet";
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(r: number, g: number, b: number): string {
  "worklet";
  const ch = (x: number) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** Mélange linéaire en RGB de deux couleurs hex : t = 0 donne `a`, t = 1 donne `b`. */
export function mix(a: string, b: string, t: number): string {
  "worklet";
  const [r1, g1, b1] = channels(a), [r2, g2, b2] = channels(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  "worklet";
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(x: number): number {
  "worklet";
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  return c * 255;
}

/** sRGB → OKLab (Björn Ottosson, 2020). */
function toOklab(hex: string): Lab {
  "worklet";
  const [r8, g8, b8] = channels(hex);
  const r = srgbToLinear(r8), g = srgbToLinear(g8), b = srgbToLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Lab): string {
  "worklet";
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

/** Mélange perceptuel (OKLab) : pas de gris terne au milieu entre une couleur sombre et une claire. */
export function mixOklab(a: string, b: string, t: number): string {
  "worklet";
  const la = toOklab(a), lb = toOklab(b);
  const k = Math.min(1, Math.max(0, t));
  return fromOklab([la[0] + (lb[0] - la[0]) * k, la[1] + (lb[1] - la[1]) * k, la[2] + (lb[2] - la[2]) * k]);
}

/** Luminance relative (WCAG) d'une couleur hex. */
function luminance(hex: string): number {
  "worklet";
  const [r, g, b] = channels(hex).map(srgbToLinear);
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Ratio de contraste WCAG (1 à 21) entre deux couleurs hex. */
export function contrastRatio(a: string, b: string): number {
  "worklet";
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Chroma OKLab (distance à l'axe des gris) : sous ≈ 0,03 une couleur paraît grise ou kaki. */
export function chroma(hex: string): number {
  const [, a, b] = toOklab(hex);
  return Math.hypot(a, b);
}

/** Couleur hex avec une opacité, au format rgba() de React Native. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Saturation HSV (0 à 1) d'une couleur hex, pour vérifier qu'un mélange ne vire pas au gris. */
export function saturation(hex: string): number {
  const c = channels(hex);
  const max = Math.max(...c), min = Math.min(...c);
  return max === 0 ? 0 : (max - min) / max;
}

/** Teinte du verre de la carte d'arrivée, posée au-dessus du flou. */
export const GLASS_TINT = { color: "#141E1A", alpha: 0.35 } as const;

/**
 * Couleur OPAQUE équivalente au verre sombre de la carte d'arrivée sur un fond de la couleur d'accent
 * voilé (`veil` = part d'encre du voile), pour que la carte passe du verre au crème sans jamais
 * devenir translucide.
 */
export function darkGlassColor(accent: string, ink: string, veil = 0.2): string {
  return mix(mix(accent, ink, veil), GLASS_TINT.color, GLASS_TINT.alpha);
}

/** Part du trajet au bout de laquelle la couleur de la carte a fait l'essentiel de son changement. */
export const CARD_COLOR_QUARTER = 0.25;
const CARD_COLOR_POWER = 6;

/**
 * Couleur de la carte à `progress` (0 → 1) du trajet : du verre sombre au crème, en OKLab, avec
 * l'essentiel du changement dans le premier quart (≈ 82 % à 0,25, ≈ 98 % à 0,5).
 */
export function cardColor(darkGlass: string, paper: string, progress: number): string {
  "worklet";
  const p = Math.min(1, Math.max(0, progress));
  return mixOklab(darkGlass, paper, 1 - (1 - p) ** CARD_COLOR_POWER);
}
