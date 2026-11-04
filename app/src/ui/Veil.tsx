import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
import { mix, withAlpha } from "@/lib/color.ts";

/**
 * Voile d'arrivée sur une vraie image : dégradé vertical, plus sombre en haut, plus léger vers le bas
 * (ciel avant l'aube). L'image reste lisible et le soleil chaud.
 */
export const IMAGE_VEIL = { top: 0.55, bottom: 0.08, ink: 0.5 } as const;

export function ImageVeil({ accent, ink }: { accent: string; ink: string }) {
  const color = mix(accent, ink, IMAGE_VEIL.ink);
  return <LinearGradient colors={[withAlpha(color, IMAGE_VEIL.top), withAlpha(color, IMAGE_VEIL.bottom)]} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}
