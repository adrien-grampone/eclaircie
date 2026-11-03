import { memo } from "react";
import { Image, StyleSheet } from "react-native";
import { absoluteFill, paperTexture } from "@/theme/tokens.ts";

const noise = require("../../assets/paper-noise.png") // Metro choisit la variante @3x;

/**
 * Texture papier : UNE image pré-rendue à la taille de l'écran (@3x), posée une fois par écran
 * au-dessus de tout, hors du contenu qui défile. Fondu multiply, 10 %. Ne capte pas les touches.
 */
export const PaperTexture = memo(function PaperTexture() {
  return <Image source={noise} resizeMode="cover" style={styles.texture} pointerEvents="none" accessible={false} fadeDuration={0} />;
});

const styles = StyleSheet.create({
  texture: { ...absoluteFill, opacity: paperTexture.opacity, mixBlendMode: "multiply" },
});
