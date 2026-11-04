import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { SOFT_EDGE, revealSize } from "@/lib/splash.ts";
import { colors } from "@/theme/tokens.ts";
import { ImageVeil } from "@/ui/Veil.tsx";

interface Props {
  url: string;
  accent: string;
  width: number;
  height: number;
  /** Centre et rayon du soleil à l'écran, diamètre couvrant l'écran. */
  cx: number;
  cy: number;
  sunRadius: number;
  full: number;
  progress: SharedValue<number>;
}

/**
 * Révélé circulaire de l'illustration de l'arrivée : l'image (cadrage « cover » plein écran, sous le
 * même voile que l'arrivée) vue à travers un cercle centré sur le soleil du splash, qui grandit jusqu'à
 * couvrir l'écran. Le bord est adouci par des anneaux concentriques plus transparents (aucun masque
 * natif : un cercle à coins arrondis en overflow hidden, l'image décalée pour rester fixe à l'écran).
 */
export function Reveal({ url, accent, width, height, cx, cy, sunRadius, full, progress }: Props) {
  const rings = [...SOFT_EDGE, { extra: 0, opacity: 1 }];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {rings.map((ring) => (
        <Circle key={ring.extra} url={url} accent={accent} width={width} height={height} cx={cx} cy={cy}
          sunRadius={sunRadius} full={full} progress={progress} extra={ring.extra} opacity={ring.opacity} />
      ))}
    </View>
  );
}

function Circle({ url, accent, width, height, cx, cy, sunRadius, full, progress, extra, opacity }: Props & { extra: number; opacity: number }) {
  const circle = useAnimatedStyle(() => {
    const size = revealSize(progress.value, sunRadius, full) + extra;
    return { width: size, height: size, borderRadius: size / 2, left: cx - size / 2, top: cy - size / 2 };
  });
  const inner = useAnimatedStyle(() => {
    const size = revealSize(progress.value, sunRadius, full) + extra;
    return { left: size / 2 - cx, top: size / 2 - cy };
  });
  return (
    <Animated.View style={[styles.circle, { opacity }, circle]}>
      <Animated.View style={[styles.inner, { width, height }, inner]}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        <ImageVeil accent={accent} ink={colors.ink} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: { position: "absolute", overflow: "hidden" },
  inner: { position: "absolute" },
});
