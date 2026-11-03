import { StyleSheet, View } from "react-native";
import { mix } from "@/lib/color.ts";

/**
 * Voile d'arrivée sur une vraie image : dégradé vertical, plus sombre en haut, plus léger vers le bas
 * (ciel avant l'aube), en bandes empilées pour ne dépendre d'aucune bibliothèque de dégradé. L'image
 * reste lisible et le soleil chaud.
 */
const BANDS = 24;
export const IMAGE_VEIL = { top: 0.55, bottom: 0.08, ink: 0.5 } as const;

export function ImageVeil({ accent, ink }: { accent: string; ink: string }) {
  const color = mix(accent, ink, IMAGE_VEIL.ink);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: BANDS }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: color, opacity: IMAGE_VEIL.top + (IMAGE_VEIL.bottom - IMAGE_VEIL.top) * (i / (BANDS - 1)) }} />
      ))}
    </View>
  );
}
