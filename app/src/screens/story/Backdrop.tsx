import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { DailyView } from "@/lib/stories.ts";
import { Sky } from "@/ui/Sky.tsx";

/**
 * Fond de la nouvelle : son illustration, sinon le ciel dessiné à la palette du thème.
 * `veil` (voile sombre de l'arrivée) couvre toute l'image, mais passe SOUS le soleil du ciel dessiné.
 */
export function Backdrop({ view, veil }: { view: DailyView; veil?: ReactNode }) {
  const { theme, image } = view;
  if (!image) return <Sky palette={theme.palette} veil={veil} />;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      {veil}
    </View>
  );
}
