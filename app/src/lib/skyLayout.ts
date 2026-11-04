/**
 * Disposition du ciel dessiné (soleil, trois collines), en pur : partagée par le composant `Sky`,
 * la transition Arrivée → Nouvelle (mouvement par transform) et l'onboarding. Aucune couleur ici.
 */
/** Hauteur des collines (pilules très hautes dont seule la calotte dépasse). */
export const HILL = 700;
/** Position et largeur des trois collines (claire, moyenne, accent), partagées avec le splash. */
export const HILL_SHAPES = [
  { left: "-45%", width: "170%" },
  { left: "-75%", width: "170%" },
  { left: "-15%", width: "170%" },
] as const;

export interface SkyLayout {
  /** `top` en pourcentage du cadre ou en points (onboarding : calculé sous le titre). */
  sun: { top: `${number}%` | number; right: `${number}%`; size: number };
  /** Hauteur à laquelle chaque colline (claire, moyenne, accent) dépasse du bas. */
  hills: [number, number, number];
}

/** Plein écran (Nouvelle du jour, Arrivée). */
export const FULL_SKY: SkyLayout = { sun: { top: "36%", right: "12%", size: 150 }, hills: [190, 125, 70] };
/** Taille du soleil du bandeau d'onboarding et écart entre ses collines. */
export const BANNER_SUN = 120;
const BANNER_HILL_GAP = 26;

/**
 * Bandeau de l'onboarding (maquette 01) : le soleil se place SOUS la zone du titre, à droite, et les
 * collines commencent au tiers du soleil pour qu'il se couche derrière elles, quelle que soit la hauteur.
 */
export function bannerSky(bannerHeight: number, titleBottom: number): SkyLayout {
  const sunTop = titleBottom;
  const hillTop = Math.min(bannerHeight - 3 * BANNER_HILL_GAP, sunTop + BANNER_SUN * 0.35);
  const rise = Math.max(3 * BANNER_HILL_GAP, bannerHeight - hillTop);
  return { sun: { top: sunTop, right: "7%", size: BANNER_SUN }, hills: [rise, rise - BANNER_HILL_GAP, rise - 2 * BANNER_HILL_GAP] };
}
