import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Image as RNImage, Pressable, StyleSheet } from "react-native";
import { useAppSize } from "@/ui/fold/FoldProvider.tsx";
import Animated, {
  Easing, cancelAnimation, runOnUI, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SPLASH_HOLD_MAX_MS } from "@/lib/deepLink.ts";
import { hapticThreshold } from "@/lib/haptics.ts";
import {
  CROSSFADE_MS, FADE_MS, HALO, HILL_PLANES, HOLD_AT, IMAGE_GRACE_MS, NIGHT, REVEAL_MS, SPLASH_COPY, SPLASH_GRAIN, SPLASH_MS,
  WORD_SHADOW, creamWeight, crestCrossingT, haloOpacity, haloScale, hillColor, overlayOpacity, revealDiameter, skyBehindWord, skyStages,
  stageOpacity, sunLayout, sunTranslate, sunrise, wordDarkColor, wordOpacity, wordTranslate,
} from "@/lib/splash.ts";
import type { SplashOutcome } from "@/lib/splashStore.ts";
import { colors, type as typo, type Palette } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Reveal } from "./splash/Reveal.tsx";

const HALO_IMAGE = require("../../assets/splash/halo.png");
const HILL_IMAGES = [require("../../assets/splash/hill-1.png"), require("../../assets/splash/hill-2.png"), require("../../assets/splash/hill-3.png")];
/**
 * Matière gouache : cartes de valeur (gris neutre ± 5 % en taches larges, crête assombrie), même forme
 * que les masques, posées en fondu soft-light par-dessus la couleur teintée. Le grain papier vient au-dessus.
 */
const HILL_VALUES = [require("../../assets/splash/hill-1-value.png"), require("../../assets/splash/hill-2-value.png"), require("../../assets/splash/hill-3-value.png")];
const SUN_VALUE = require("../../assets/splash/sun-value.png");

interface Props {
  /** Palette visée par le lever (thème du jour s'il est connu, sinon le dernier affiché, sinon Planète). */
  palette: Palette;
  /** Ce que fait la fin : `null` tant que l'écran d'entrée n'est pas prêt (on tient la dernière image). */
  outcome: SplashOutcome | null;
  /** Appelé à la première image ; sa promesse résolue (splash natif retiré) lance la ligne de temps. */
  onFirstFrame: () => Promise<void>;
  onDone: () => void;
  /** Dernière image tenue plus de SPLASH_HOLD_MAX_MS sans issue signalée : l'appelant force le fondu. */
  onHoldTimeout?: () => void;
  /** Dev : ne finit jamais et fige le révélé à mi-course pour l'examiner. */
  hold?: boolean;
}

/**
 * Splash animé, posé au-dessus de l'écran d'entrée au démarrage à froid. Tout le mouvement vit sur le
 * fil UI (une seule valeur partagée `t`, styles dérivés), aucun setState avant la fin. Ciel en étapes
 * (dégradés fondus l'un dans l'autre), soleil centré qui se lève derrière la crête, halo flou, collines
 * ondulées teintées, grain papier. Si l'arrivée a une illustration, préchargée pendant le lever, elle
 * est révélée en cercle depuis le soleil (Reveal) puis le contenu de l'arrivée apparaît en fondu ;
 * sinon (image pas prête, ou « Réduire les animations ») la dernière image se fond dans l'arrivée.
 * Tap = saut à l'état final.
 */
export function Splash({ palette, outcome, onFirstFrame, onDone, onHoldTimeout, hold = false }: Props) {
  const { width, height } = useAppSize();
  const reducedMotion = useReducedMotion();
  const t = useSharedValue(0);
  const fade = useSharedValue(1);
  const ready = useSharedValue<SplashOutcome["kind"] | null>(null);
  const finishing = useSharedValue(false);
  const imageReady = useSharedValue(false);
  const imagePending = useSharedValue(false);
  const reveal = useSharedValue(0);
  const started = useSharedValue(false);
  const [image, setImage] = useState<{ url: string; accent: string } | null>(null);
  const sun = sunLayout(width, height);
  const crestT = crestCrossingT(sun);

  const done = () => onDone();
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;
  /** Garde-fou absolu : armé quand la dernière image est atteinte, quelle que soit la route dessous. */
  const armHoldTimer = () => {
    if (hold) return;
    setTimeout(() => { if (!outcomeRef.current) onHoldTimeout?.(); }, SPLASH_HOLD_MAX_MS);
  };
  const endGrace = () => { setTimeout(() => runOnUI(() => { imagePending.value = false; tryFinish(); })(), IMAGE_GRACE_MS); };
  /** Fin : révélé (image prête), fondu croisé (arrival sans image) ou simple fondu, une fois prêt et la dernière image atteinte. */
  const tryFinish = () => {
    "worklet";
    if (finishing.value || ready.value === null || t.value < HOLD_AT || hold) return;
    if (imagePending.value && !imageReady.value) { scheduleOnRN(endGrace); return; }
    finishing.value = true;
    if (ready.value === "arrival" && !reducedMotion && imageReady.value) {
      reveal.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.inOut(Easing.cubic) }, (ok) => {
        if (ok) fade.value = withTiming(0, { duration: FADE_MS }, (ok2) => { if (ok2) scheduleOnRN(done); });
      });
    } else if (ready.value === "arrival" && !reducedMotion) {
      t.value = withTiming(1, { duration: CROSSFADE_MS, easing: Easing.inOut(Easing.quad) }, (ok) => { if (ok) scheduleOnRN(done); });
    } else {
      fade.value = withTiming(0, { duration: FADE_MS }, (ok) => { if (ok) scheduleOnRN(done); });
    }
  };
  const start = () => {
    runOnUI(() => {
      if (started.value) return;
      started.value = true;
      if (reducedMotion) { t.value = HOLD_AT; tryFinish(); scheduleOnRN(armHoldTimer); return; }
      t.value = withTiming(HOLD_AT, { duration: SPLASH_MS * HOLD_AT, easing: Easing.linear }, (ok) => { if (ok) { tryFinish(); scheduleOnRN(armHoldTimer); } });
    })();
  };
  const firstFrame = () => { onFirstFrame().then(start, start); };

  useEffect(() => {
    if (!outcome) return;
    const kind = outcome.kind;
    if (outcome.kind === "arrival" && outcome.image && !reducedMotion) {
      const { image: url, palette: { accent } } = outcome;
      let cancelled = false;
      Image.prefetch(url, "memory-disk").then((ok) => {
        if (cancelled) return;
        if (ok) setImage({ url, accent });
        runOnUI(() => { imageReady.value = ok; imagePending.value = false; if (hold && ok) reveal.value = 0.5; tryFinish(); })();
      }).catch(() => runOnUI(() => { imagePending.value = false; tryFinish(); })());
      runOnUI(() => { imagePending.value = true; ready.value = kind; tryFinish(); })();
      return () => { cancelled = true; };
    }
    runOnUI(() => { ready.value = kind; tryFinish(); })();
    return undefined;
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
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sunTranslate(sunrise(t.value), sun.hideOffset) }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity(t.value),
    transform: [{ translateY: sunTranslate(sunrise(t.value), sun.hideOffset) }, { scale: haloScale(t.value) }],
  }));
  const stages = skyStages(palette);
  const wordDark = wordDarkColor(palette, colors.ink);
  // Le mot existe en deux variantes (accent foncé, crème ombrée) fondues selon celle qui contraste le mieux avec le ciel du moment.
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity(t.value), transform: [{ translateY: wordTranslate(t.value) }] }));
  const creamStyle = useAnimatedStyle(() => ({ opacity: creamWeight(skyBehindWord(stages, sunrise(t.value)), wordDark, colors.paper) }));
  const darkStyle = useAnimatedStyle(() => ({ opacity: 1 - creamWeight(skyBehindWord(stages, sunrise(t.value)), wordDark, colors.paper) }));
  const hillFinal = [palette.hill_light, palette.hill_mid, palette.accent];
  const haloSize = sun.size * HALO.size;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} onLayout={firstFrame}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" accessibilityLabel="Passer l'animation">
        {stages.map((stage, i) => <Stage key={i} index={i} top={stage.top} horizon={stage.horizon} t={t} />)}
        <Animated.Image source={HALO_IMAGE} style={[styles.halo, { width: haloSize, height: haloSize, left: sun.cx - haloSize / 2, top: sun.cy - haloSize / 2, tintColor: palette.sun }, haloStyle]} />
        <Animated.View style={[styles.sun, { width: sun.size, height: sun.size, borderRadius: sun.size / 2, left: sun.cx - sun.size / 2, top: sun.cy - sun.size / 2, backgroundColor: palette.sun }, sunStyle]}>
          <RNImage source={SUN_VALUE} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.value]} accessible={false} />
        </Animated.View>
        {HILL_PLANES.map((plane, i) => <Hill key={i} source={HILL_IMAGES[i]} value={HILL_VALUES[i]} width={width} height={height * plane.heightShare} final={hillFinal[i] ?? palette.accent} t={t} />)}
        <Animated.View style={[styles.word, wordStyle]} pointerEvents="none">
          <Animated.Text style={[typo.title, styles.wordText, { color: wordDark }, darkStyle]}>{SPLASH_COPY.word}</Animated.Text>
          <Animated.Text style={[typo.title, styles.wordText, styles.wordCream, creamStyle]}>{SPLASH_COPY.word}</Animated.Text>
        </Animated.View>
        {image ? (
          <Reveal url={image.url} accent={image.accent} width={width} height={height} cx={sun.cx} cy={sun.cy}
            sunRadius={sun.size / 2} full={revealDiameter(sun.cx, sun.cy, width, height)} progress={reveal} />
        ) : null}
        <PaperTexture opacity={SPLASH_GRAIN} />
      </Pressable>
    </Animated.View>
  );
}

/** Une étape du ciel : dégradé vertical, qui se fond par-dessus la précédente au fil du lever. */
function Stage({ index, top, horizon, t }: { index: number; top: string; horizon: string; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: stageOpacity(index, sunrise(t.value)) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient colors={[top, horizon]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** Un plan de collines : masque PNG ondulé étiré à la largeur, teinté de la silhouette à sa couleur, puis sa carte de valeur. */
function Hill({ source, value, width, height, final, t }: { source: number; value: number; width: number; height: number; final: string; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ tintColor: hillColor(final, sunrise(t.value)) }));
  return (
    <>
      <Animated.Image source={source} resizeMode="stretch" style={[styles.hill, { width, height }, style]} />
      <RNImage source={value} resizeMode="stretch" style={[styles.hill, styles.value, { width, height }]} accessible={false} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: NIGHT.top, zIndex: 10 },
  halo: { position: "absolute" },
  sun: { position: "absolute", overflow: "hidden" },
  value: { mixBlendMode: "soft-light" },
  hill: { position: "absolute", left: 0, bottom: 0 },
  word: { position: "absolute", left: 0, right: 0, top: "26%", alignItems: "center" },
  wordText: { fontSize: 44, lineHeight: 52 },
  wordCream: { position: "absolute", color: colors.paper, textShadowColor: WORD_SHADOW.color, textShadowRadius: WORD_SHADOW.radius, textShadowOffset: { width: 0, height: 2 } },
});
