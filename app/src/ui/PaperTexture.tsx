import { memo } from "react";
import { Image, StyleSheet } from "react-native";
import { absoluteFill, paperTexture } from "@/theme/tokens.ts";

const noise = require("../../assets/paper-noise.png") // Metro choisit la variante @3x;
/** Même grain recentré sur le gris moyen : en lumière douce, il texture un fond foncé sans l'éclaircir. */
const darkNoise = require("../../assets/paper-noise-dark.png");

/**
 * Texture papier : UNE image pré-rendue à la taille de l'écran (@3x), posée une fois par écran
 * au-dessus de tout, hors du contenu qui défile. Fondu multiply, 10 %. Ne capte pas les touches.
 */
/** `dark` : grain en lumière douce, pour un fond foncé (le grain « multiply » n'y laisse rien de visible). */
export const PaperTexture = memo(function PaperTexture({ opacity = paperTexture.opacity, dark = false }: { opacity?: number; dark?: boolean }) {
  return (
    <Image source={dark ? darkNoise : noise} resizeMode="cover" style={[styles.texture, { opacity, mixBlendMode: dark ? "soft-light" : "multiply" }]}
      pointerEvents="none" accessible={false} fadeDuration={0} />
  );
});

const styles = StyleSheet.create({
  // Taille explicite : sans elle, l'image garde sa largeur naturelle (440 pt) au lieu de remplir un écran plus large.
  texture: { ...absoluteFill, width: "100%", height: "100%" },
});
