import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { mix } from "@/lib/color.ts";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Ciel de secours dessiné avec la palette du thème (dégradé par bandes, soleil en cercle parfait,
 * trois collines) quand ni illustration ni image de secours n'existe. Aucune couleur en dur.
 * `veil` (voile sombre de l'arrivée) se glisse ENTRE le ciel et le soleil : le soleil reste lumineux.
 */
const BANDS = 24;
/** Hauteur des collines (pilules très hautes dont seule la calotte dépasse). */
const HILL = 700;

export function Sky({ palette, veil }: { palette: Palette; veil?: ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: mix(palette.sky_top, palette.sky_bottom, i / (BANDS - 1)) }} />
      ))}
      {veil}
      <View style={[styles.sun, { backgroundColor: palette.sun }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_light, left: "-45%", width: "170%", bottom: -HILL + 190 }]} />
      <View style={[styles.hill, { backgroundColor: palette.hill_mid, left: "-75%", width: "170%", bottom: -HILL + 125 }]} />
      <View style={[styles.hill, { backgroundColor: palette.accent, left: "-15%", width: "170%", bottom: -HILL + 70 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sun: { position: "absolute", top: "36%", right: "12%", width: 150, height: 150, borderRadius: 75 },
  hill: { position: "absolute", height: HILL, borderRadius: HILL / 2 },
});
