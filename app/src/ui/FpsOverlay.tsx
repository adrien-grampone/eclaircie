import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue } from "react-native-reanimated";

const AnimatedInput = Animated.createAnimatedComponent(TextInput);
/** Fenêtre de mesure. */
const WINDOW_MS = 500;

/**
 * Compteur d'images par seconde du FIL UI (développement) : compte les rappels de useFrameCallback
 * sur une fenêtre glissante et écrit le résultat dans un TextInput via animatedProps, sans passer
 * par JavaScript. Sur un iPhone ProMotion, une animation fluide affiche ~120.
 */
export function FpsOverlay() {
  const frames = useSharedValue(0);
  const since = useSharedValue(0);
  const fps = useSharedValue(0);
  useFrameCallback((info) => {
    frames.value += 1;
    if (since.value === 0) since.value = info.timestamp;
    const elapsed = info.timestamp - since.value;
    if (elapsed >= WINDOW_MS) {
      fps.value = Math.round((frames.value * 1000) / elapsed);
      frames.value = 0;
      since.value = info.timestamp;
    }
  });
  // `text` est une prop native de TextInput absente de ses types : passage par unknown.
  const animatedProps = useAnimatedProps(() => ({ text: `${fps.value} fps` }) as unknown as Partial<TextInputProps>);
  return <AnimatedInput editable={false} defaultValue="– fps" animatedProps={animatedProps} style={styles.badge} pointerEvents="none" accessible={false} />;
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: 54, left: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontVariant: ["tabular-nums"], zIndex: 100 },
});
