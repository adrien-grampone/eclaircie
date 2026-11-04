import type { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { FULL_SKY, HILL, HILL_SHAPES, type SkyLayout } from "@/lib/skyLayout.ts";
import type { Palette } from "@/theme/tokens.ts";

export { BANNER_SUN, FULL_SKY, HILL, HILL_SHAPES, bannerSky, type SkyLayout } from "@/lib/skyLayout.ts";

/**
 * Ciel dessiné avec la palette du thème (dégradé vertical, soleil en cercle parfait, trois
 * collines) : fond de secours de la Nouvelle, illustration de l'onboarding. Aucune couleur en dur.
 * `veil` (voile sombre de l'arrivée) se glisse ENTRE le ciel et le soleil : le soleil reste lumineux.
 * La disposition (lib/skyLayout.ts) est aussi celle que la transition d'arrivée anime par transform.
 */
export function Sky({ palette, veil, layout = FULL_SKY }: { palette: Palette; veil?: ReactNode; layout?: SkyLayout }) {
  const { sun, hills } = layout;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[palette.sky_top, palette.sky_bottom]} style={StyleSheet.absoluteFill} />
      {veil}
      <View style={[styles.sun, { backgroundColor: palette.sun, top: sun.top, right: sun.right, width: sun.size, height: sun.size, borderRadius: sun.size / 2 }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_light, ...HILL_SHAPES[0], bottom: -HILL + hills[0] }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_mid, ...HILL_SHAPES[1], bottom: -HILL + hills[1] }]} />
      <View style={[styles.hill, { backgroundColor: palette.accent, ...HILL_SHAPES[2], bottom: -HILL + hills[2] }]} />
    </View>
  );
}

export const skyStyles = StyleSheet.create({
  sun: { position: "absolute" },
  hill: { position: "absolute", height: HILL, borderRadius: HILL / 2 },
});
const styles = skyStyles;
