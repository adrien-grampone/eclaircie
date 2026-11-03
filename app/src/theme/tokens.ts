/**
 * Tokens de la direction visuelle (spec §5). Les palettes des thèmes ne sont PAS ici :
 * elles viennent de la table `themes` (colonne palette), jamais en dur.
 */
export const colors = {
  paper: "#F5EFE4",
  ink: "#1F1B16",
  inkSecondary: "#3A342C",
  caption: "#6B6257",
  white: "#FFFFFF",
} as const;

export const fonts = {
  title: "Fraunces_600SemiBold",
  /** Fraunces en graisse normale : thèmes non cochés de l'onboarding. */
  titleRegular: "Fraunces_400Regular",
  titleAccent: "Fraunces_400Regular_Italic",
  body: "DMSans_400Regular",
  bodyBold: "DMSans_600SemiBold",
} as const;

/** Taille du titre par paliers selon sa longueur totale (title_main + title_accent), 3 lignes max. */
export const titleTiers = [
  { maxChars: 30, fontSize: 36 },
  { maxChars: 44, fontSize: 32 },
  { maxChars: Number.POSITIVE_INFINITY, fontSize: 28 },
] as const;
/** Interlignage serré des titres (~1,02). */
export const titleLineHeight = 1.04;

export const type = {
  title: { fontFamily: fonts.title },
  titleAccent: { fontFamily: fonts.titleAccent },
  body: { fontFamily: fonts.body, fontSize: 18, lineHeight: 27, color: colors.inkSecondary },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1.5, color: colors.caption },
  source: { fontFamily: fonts.titleAccent, fontSize: 15, color: colors.caption },
  button: { fontFamily: fonts.bodyBold, fontSize: 17 },
  pill: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
} as const;

/** Remplissage absolu d'un parent (StyleSheet.absoluteFillObject n'existe plus en RN 0.88). */
export const absoluteFill = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

export const radius = { button: 16, sheet: 30, pill: 999 } as const;
export const space = { xs: 6, s: 12, m: 16, l: 24, xl: 32 } as const;
export const sizes = { button: 54, glassButton: 52, dropCap: 64 } as const;
/** Texture papier : PNG de bruit en tuile, multiply, 10 %. */
export const paperTexture = { opacity: 0.1 } as const;
/** Verre : flou expo-blur ~40 + bordure blanche à 50 %. */
export const glass = { intensity: 40, border: "rgba(255,255,255,0.5)", tint: "rgba(245,239,228,0.55)" } as const;

/** Palette d'un thème telle que stockée dans themes.palette. */
export interface Palette {
  sky_top: string;
  sky_bottom: string;
  sun: string;
  hill_light: string;
  hill_mid: string;
  accent: string;
}
