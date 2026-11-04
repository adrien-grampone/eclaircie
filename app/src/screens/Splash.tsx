import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, cancelAnimation, runOnUI, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SUN_DROP, SUN_ZOOM } from "@/lib/arrivalBackdrop.ts";
import { hapticThreshold } from "@/lib/haptics.ts";
import {
  BANDS, FADE_MS, HOLD_AT, NIGHT, REVEAL_MS, SPLASH_COPY, SPLASH_HILLS, SPLASH_MS, crestCrossingT, haloOpacity, haloScale, hillColor,
  overlayOpacity, skyBand, sunGeometry, sunHideOffset, sunTranslate, sunrise, wordOpacity, wordTranslate,
} from "@/lib/splash.ts";
import type { SplashOutcome } from "@/lib/splashStore.ts";
import { colors, type as typo, type Palette } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { FULL_SKY, HILL, HILL_SHAPES, skyStyles } from "@/ui/Sky.tsx";

interface Props {
  /** Palette visée par le lever (thème du jour s'il est connu, sinon le dernier affiché, sinon Planète). */
  palette: Palette;
  /** Ce que fait la fin : `null` tant que l'écran d'entrée n'est pas prêt (on tient la dernière image). */
  outcome: SplashOutcome | null;
  /** Appelé à la première image ; sa promesse résolue (splash natif retiré) lance la ligne de temps. */
  onFirstFrame: () => Promise<void>;
  onDone: () => void;
}

/**
 * Splash animé, posé au-dessus de l'écran d'entrée au démarrage à froid. Tout le mouvement vit sur le
 * fil UI (une seule valeur partagée `t`, styles dérivés), aucun setState avant la fin. La dernière
 * image reprend la géométrie exacte du fond d'« Arrivée du jour » (Sky plein écran, SUN_DROP/SUN_ZOOM,
 * bandes voilées), l'écran apparaît en fondu par-dessus. Tap = saut à l'état final.
 */
export function Splash({ palette, outcome, onFirstFrame, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const t = useSharedValue(0);
  const fade = useSharedValue(1);
  const ready = useSharedValue<SplashOutcome["kind"] | null>(null);
  const finishing = useSharedValue(false);
  const geometry = sunGeometry(height, parseFloat(FULL_SKY.sun.top as string) / 100, FULL_SKY.sun.size, SPLASH_HILLS[0]);
  const hideOffset = sunHideOffset(geometry);
  const crestT = crestCrossingT(geometry);

  const done = () => onDone();
  /** Fin : l'écran apparaît (arrival) ou simple fondu (fade), seulement une fois prêt et la dernière image atteinte. */
  const tryFinish = () => {
    "worklet";
    if (finishing.value || ready.value === null || t.value < HOLD_AT) return;
    finishing.value = true;
    if (ready.value === "arrival" && !reducedMotion) {
      t.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.inOut(Easing.quad) }, (ok) => { if (ok) scheduleOnRN(done); });
    } else {
      fade.value = withTiming(0, { duration: FADE_MS }, (ok) => { if (ok) scheduleOnRN(done); });
    }
  };

  const started = useSharedValue(false);
  /** Lance la ligne de temps une seule fois, quand le splash natif est retiré (aucune image perdue). */
  const start = () => {
    runOnUI(() => {
      if (started.value) return;
      started.value = true;
      if (reducedMotion) { t.value = HOLD_AT; tryFinish(); return; }
      t.value = withTiming(HOLD_AT, { duration: SPLASH_MS * HOLD_AT, easing: Easing.linear }, (ok) => { if (ok) tryFinish(); });
    })();
  };
  const firstFrame = () => { onFirstFrame().then(start, start); };

  useEffect(() => {
    if (!outcome) return;
    const kind = outcome.kind;
    runOnUI(() => { ready.value = kind; tryFinish(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const skip = () => {
    runOnUI(() => {
      if (finishing.value) return;
      cancelAnimation(t);
      t.value = HOLD_AT;
      tryFinish();
    })();
  };

  useAnimatedReaction(() => t.value >= crestT, (now, before) => { if (now && !before) scheduleOnRN(hapticThreshold); });

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity(t.value) * fade.value }));
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sunTranslate(sunrise(t.value), hideOffset) }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity(t.value),
    transform: [{ translateY: sunTranslate(sunrise(t.value), hideOffset) }, { scale: haloScale(t.value) }],
  }));
  const hillFinal = [palette.hill_light, palette.hill_mid, palette.accent] as const;
  const hill0 = useAnimatedStyle(() => ({ backgroundColor: hillColor(hillFinal[0], sunrise(t.value)) }));
  const hill1 = useAnimatedStyle(() => ({ backgroundColor: hillColor(hillFinal[1], sunrise(t.value)) }));
  const hill2 = useAnimatedStyle(() => ({ backgroundColor: hillColor(hillFinal[2], sunrise(t.value)) }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity(t.value), transform: [{ translateY: wordTranslate(t.value) }] }));

  const { sun } = FULL_SKY;
  const hills = SPLASH_HILLS;
  const sunFrame = { top: sun.top, right: sun.right, width: sun.size, height: sun.size, borderRadius: sun.size / 2 };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} onLayout={firstFrame}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" accessibilityLabel="Passer l'animation">
        {/* Même cadre que le fond de l'arrivée : plein écran, agrandi et décalé vers le bas. */}
        <View style={[styles.frame, { width, height, transform: [{ translateY: height * SUN_DROP }, { scale: SUN_ZOOM }] }]}>
          {Array.from({ length: BANDS }, (_, i) => <Band key={i} index={i} palette={palette} t={t} />)}
          <Animated.View style={[skyStyles.sun, sunFrame, { backgroundColor: palette.sun }, haloStyle]} />
          <Animated.View style={[skyStyles.sun, sunFrame, { backgroundColor: palette.sun }, sunStyle]} />
          <Animated.View style={[skyStyles.hill, hillFrame(HILL_SHAPES[0], width, hills[0]), hill0]} />
          <Animated.View style={[skyStyles.hill, hillFrame(HILL_SHAPES[1], width, hills[1]), hill1]} />
          <Animated.View style={[skyStyles.hill, hillFrame(HILL_SHAPES[2], width, hills[2]), hill2]} />
        </View>
        <Animated.View style={[styles.word, wordStyle]} pointerEvents="none">
          <Text style={[typo.title, styles.wordText]}>{SPLASH_COPY.word}</Text>
        </Animated.View>
        <PaperTexture />
      </Pressable>
    </Animated.View>
  );
}

/** Position d'une colline en points (les pourcentages de Sky, résolus sur la largeur du cadre). */
function hillFrame(shape: { left: `${number}%`; width: `${number}%` }, frameWidth: number, rise: number) {
  const pct = (v: string) => (parseFloat(v) / 100) * frameWidth;
  return { left: pct(shape.left), width: pct(shape.width), bottom: -HILL + rise };
}

/** Une bande du ciel, de la nuit à sa couleur d'arrivée (OKLab) au fil du lever. */
function Band({ index, palette, t }: { index: number; palette: Palette; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ backgroundColor: skyBand(index, palette, colors.ink, sunrise(t.value)) }));
  return <Animated.View style={[styles.band, style]} />;
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: NIGHT.top, zIndex: 10 },
  frame: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  band: { flex: 1 },
  word: { position: "absolute", left: 0, right: 0, top: "30%", alignItems: "center" },
  wordText: { fontSize: 44, lineHeight: 52, color: colors.paper },
});
