import { StyleSheet, View } from "react-native";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Ciel de secours dessiné avec la palette du thème (dégradé par bandes, soleil en cercle parfait,
 * trois collines) quand ni illustration ni image de secours n'existe. Aucune couleur en dur.
 */
const BANDS = 24;
/** Hauteur des collines (pilules très hautes dont seule la calotte dépasse). */
const HILL = 700;

function mix(a: string, b: string, t: number): string {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  const [r1, g1, b1] = c(a), [r2, g2, b2] = c(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

export function Sky({ palette }: { palette: Palette }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: mix(palette.sky_top, palette.sky_bottom, i / (BANDS - 1)) }} />
      ))}
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
