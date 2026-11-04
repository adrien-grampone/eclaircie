import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { ILLUSTRATION_ASPECT } from "@pipeline/illustration.ts";
import { SKY_PARTS, imageFrames, lerpRect, motionTransform, rectMotion, skyFrames, type Rect, type SkyPart } from "@/lib/arrivalMotion.ts";
import { FULL_SKY, HILL } from "@/lib/skyLayout.ts";
import type { DailyView } from "@/lib/stories.ts";
import { absoluteFill, type Palette } from "@/theme/tokens.ts";

interface Props {
  view: DailyView;
  progress: SharedValue<number>;
  /** Voile sombre de l'arrivée (opacité animée par l'appelant), plein écran, sous le soleil dessiné. */
  veil: ReactNode;
  width: number;
  height: number;
  imageHeight: number;
}

/**
 * Fond de la transition Arrivée → Nouvelle. Chaque calque est posé UNE fois (illustration à son
 * cadrage d'arrivée, éléments du ciel à leur place finale) et ne bouge que par transform : aucune
 * hauteur animée, aucun recadrage par image. À progress = 1, le rendu coïncide avec `Backdrop`.
 */
export function MotionBackdrop({ view, progress, veil, width, height, imageHeight }: Props) {
  const screen = { w: width, h: height };
  if (view.image) return <MotionImage url={view.image.url} progress={progress} veil={veil} screen={screen} imageHeight={imageHeight} />;
  return <MotionSky palette={view.theme.palette} progress={progress} veil={veil} screen={screen} imageHeight={imageHeight} />;
}

/** Vue posée en `frames.arrival`, animée vers `frames.final` par un seul mouvement. */
function Moving({ frames, progress, style, children }: { frames: { arrival: Rect; final: Rect }; progress: SharedValue<number>; style?: object; children?: ReactNode }) {
  const base = frames.arrival;
  const animated = useAnimatedStyle(() => ({ transform: motionTransform(rectMotion(base, lerpRect(base, frames.final, progress.value))) }));
  return <Animated.View style={[styles.abs, { left: base.x, top: base.y, width: base.w, height: base.h }, style, animated]}>{children}</Animated.View>;
}

function MotionImage({ url, progress, veil, screen, imageHeight }: { url: string; progress: SharedValue<number>; veil: ReactNode; screen: { w: number; h: number }; imageHeight: number }) {
  // Ratio réel connu au chargement (3:4 par construction du pipeline) ; l'image est déjà affichée au repos.
  const [ratio, setRatio] = useState<{ w: number; h: number }>({ w: ILLUSTRATION_ASPECT.width, h: ILLUSTRATION_ASPECT.height });
  const frames = imageFrames(screen, imageHeight, ratio);
  return (
    <View style={styles.clip}>
      <Moving frames={frames} progress={progress}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={300}
          onLoad={(e) => setRatio({ w: e.source.width, h: e.source.height })} />
      </Moving>
      {veil}
    </View>
  );
}

function MotionSky({ palette, progress, veil, screen, imageHeight }: { palette: Palette; progress: SharedValue<number>; veil: ReactNode; screen: { w: number; h: number }; imageHeight: number }) {
  const frames = skyFrames(FULL_SKY, screen, imageHeight);
  const fill: Record<SkyPart, string> = { gradient: palette.sky_top, sun: palette.sun, hill0: palette.hill_light, hill1: palette.hill_mid, hill2: palette.accent };
  return (
    <View style={styles.clip}>
      <Moving frames={frames.gradient} progress={progress}>
        <LinearGradient colors={[palette.sky_top, palette.sky_bottom]} style={StyleSheet.absoluteFill} />
      </Moving>
      {veil}
      {SKY_PARTS.filter((part) => part !== "gradient").map((part) => (
        <Moving key={part} frames={frames[part]} progress={progress}
          style={{ backgroundColor: fill[part], borderRadius: part === "sun" ? FULL_SKY.sun.size / 2 : HILL / 2 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...absoluteFill, overflow: "hidden" },
  abs: { position: "absolute" },
});
