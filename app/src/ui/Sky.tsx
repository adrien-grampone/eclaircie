import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { mix } from "@/lib/color.ts";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Ciel dessiné avec la palette du thème (dégradé par bandes, soleil en cercle parfait, trois
 * collines) : fond de secours de la Nouvelle, illustration de l'onboarding. Aucune couleur en dur.
 * `veil` (voile sombre de l'arrivée) se glisse ENTRE le ciel et le soleil : le soleil reste lumineux.
 */
const BANDS = 24;
/** Hauteur des collines (pilules très hautes dont seule la calotte dépasse). */
const HILL = 700;

export interface SkyLayout {
  sun: { top: `${number}%`; right: `${number}%`; size: number };
  /** Hauteur à laquelle chaque colline (claire, moyenne, accent) dépasse du bas. */
  hills: [number, number, number];
}

/** Plein écran (Nouvelle du jour, Arrivée). */
export const FULL_SKY: SkyLayout = { sun: { top: "36%", right: "12%", size: 150 }, hills: [190, 125, 70] };
/** Bandeau de l'onboarding (maquette 01) : soleil plus grand, collines basses. */
export const BANNER_SKY: SkyLayout = { sun: { top: "27%", right: "13%", size: 176 }, hills: [110, 65, 30] };

export function Sky({ palette, veil, layout = FULL_SKY }: { palette: Palette; veil?: ReactNode; layout?: SkyLayout }) {
  const { sun, hills } = layout;
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: mix(palette.sky_top, palette.sky_bottom, i / (BANDS - 1)) }} />
      ))}
      {veil}
      <View style={[styles.sun, { backgroundColor: palette.sun, top: sun.top, right: sun.right, width: sun.size, height: sun.size, borderRadius: sun.size / 2 }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_light, left: "-45%", width: "170%", bottom: -HILL + hills[0] }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_mid, left: "-75%", width: "170%", bottom: -HILL + hills[1] }]} />
      <View style={[styles.hill, { backgroundColor: palette.accent, left: "-15%", width: "170%", bottom: -HILL + hills[2] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: "absolute" },
  hill: { position: "absolute", height: HILL, borderRadius: HILL / 2 },
});
