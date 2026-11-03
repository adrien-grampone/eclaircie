import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { absoluteFill, paperTexture } from "@/theme/tokens.ts";

const noise = require("../../assets/paper-noise.png");

/**
 * Overlay de texture papier : tuile de bruit répétée en grille (resizeMode "repeat" n'est pas
 * honoré par la nouvelle architecture), fondu multiply, 10 %. Ne capte pas les touches.
 */
export function PaperTexture() {
  const { width, height } = useWindowDimensions();
  const { tile, opacity } = paperTexture;
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  return (
    <View style={[absoluteFill, styles.layer, { opacity }]} pointerEvents="none" accessible={false}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }, (_, c) => <Image key={c} source={noise} style={{ width: tile, height: tile }} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { overflow: "hidden", mixBlendMode: "multiply" },
  row: { flexDirection: "row" },
});
