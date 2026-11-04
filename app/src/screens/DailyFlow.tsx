import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { readHintShown, writeArrivalSeen, writeHintShown } from "@/lib/arrivalStore.ts";
import { VEIL_ACCENT, VEIL_INK } from "@/lib/arrivalBackdrop.ts";
import { cardGeometry, cardRect } from "@/lib/arrivalMotion.ts";
import { darkGlassColor } from "@/lib/color.ts";
import { RELEASE_CONFIG, crossedThreshold, decideRelease, progressFromDrag } from "@/lib/gesture.ts";
import { hapticLand, hapticThreshold } from "@/lib/haptics.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, space } from "@/theme/tokens.ts";
import { GlassButton, ThemePill } from "@/ui/Glass.tsx";
import { BookmarkIcon, MenuIcon } from "@/ui/Icons.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { ImageVeil } from "@/ui/Veil.tsx";
import { ARRIVAL_CARD_HEIGHT, ArrivalCardContent, ArrivalHeader } from "./Arrival.tsx";
import { CardPieces, GLASS_BACK_MS, GLASS_SWAP_MS, GlassCard } from "./arrival/MotionCard.tsx";
import { MotionBackdrop } from "./arrival/MotionBackdrop.tsx";
import { DailyStoryScreen, sheetLayout, sheetStyle } from "./DailyStory.tsx";
import { SheetContent } from "./story/StoryContent.tsx";

/** Durée de la transition signature quand elle est déclenchée par un tap (bouton ou carte). */
const DURATION_MS = 1300;
/** Ressort de fin de geste : termine ou revient en place, sans dépasser. */
const SPRING = { damping: 20, stiffness: 150, overshootClamping: true } as const;
/** Fondu quand « Réduire les animations » est activé. */
const FADE_MS = 350;
/** Délai avant la transition automatique (démonstration). */
const AUTO_DISCOVER_MS = 1500;
/** Rebond de première arrivée : amplitude (part du trajet) et délai. */
const HINT_PROGRESS = 0.07;
const HINT_DELAY_MS = 900;
/**
 * Contenus, SANS chevauchement : celui de l'arrivée glisse vers le haut en s'effaçant (0 → 25 %), puis
 * la nouvelle apparaît de 30 à 70 % avec un léger glissement depuis le bas. Le court instant sur la
 * carte crème unie est voulu.
 */
const ARRIVAL_FADE = [0, 0.25] as const;
const ARRIVAL_LIFT = -48;
const STORY_FADE = [0.3, 0.7] as const;
const STORY_RISE = 12;
/** La barre du haut (pastilles en verre) n'apparaît que sur la toute fin, quand le fond ne bouge presque plus. */
const TOP_BAR_FADE = [0.9, 1] as const;

interface Props {
  view: DailyView;
  userId: string;
  showArrival: boolean;
  autoDiscover?: boolean;
}

/**
 * Arrivée du jour → Nouvelle du jour (spec §8) : le fond assombri remonte (le soleil monte), les
 * textes d'accueil s'effacent, la carte en verre glisse et devient la feuille crème, puis l'écran
 * réel, défilable, prend le relais au pixel près. Pilotée au doigt (tirer la carte vers le haut),
 * au tap (bouton Découvrir ou la carte), ou en simple fondu si « Réduire les animations » est actif.
 *
 * Performance (120 Hz) : tout ce qui bouge le fait par transform/opacity sur le fil UI, à partir de
 * vues posées une fois à leur taille finale (lib/arrivalMotion.ts) ; le verre (BlurView) est remplacé
 * par un aplat dès que le mouvement commence ; aucun appel JavaScript avant la toute fin.
 */
export function DailyFlow({ view, userId, showArrival, autoDiscover = false }: Props) {
  const [phase, setPhase] = useState<"arrival" | "fading" | "story">(showArrival ? "arrival" : "story");
  const [blur, setBlur] = useState(true);
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const crossed = useSharedValue(false);
  const fade = useSharedValue(1);
  const glassOn = useSharedValue(1);
  const { imageHeight, sheetTop } = sheetLayout(height);
  const accent = view.theme.palette.accent;
  const movesSun = view.image === null;
  const geometry = cardGeometry({ w: width, h: height }, { insetBottom: insets.bottom, margin: space.m, cardHeight: ARRIVAL_CARD_HEIGHT, sheetTop, radius: sheetStyle.borderTopLeftRadius });
  /** Trajet de la carte vers le haut, du repos à la position de la feuille. */
  const travel = geometry.rest.y - geometry.final.y;

  const finish = () => {
    hapticLand();
    void writeArrivalSeen(view.today);
    setPhase("story");
  };
  const onDone = (done?: boolean) => {
    "worklet";
    if (done) scheduleOnRN(finish);
  };
  /** Le verre laisse place à l'aplat (fondu court dans le temps, puis le BlurView est démonté). */
  const beginMotion = () => {
    if (!blur) return;
    glassOn.value = withTiming(0, { duration: GLASS_SWAP_MS }, (done) => { if (done) scheduleOnRN(setBlur, false); });
  };
  /** Carte revenue au repos : le vrai verre revient en fondu. */
  const restoreGlass = () => {
    setBlur(true);
    glassOn.value = withTiming(1, { duration: GLASS_BACK_MS });
  };
  const discover = () => {
    if (reducedMotion) {
      setPhase("fading");
      fade.value = withTiming(0, { duration: FADE_MS }, (done) => { if (done) scheduleOnRN(finish); });
      return;
    }
    beginMotion();
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.inOut(Easing.cubic) }, onDone);
  };

  const pan = usePanGesture({
    enabled: !reducedMotion,
    activeOffsetY: [-8, 8],
    onActivate: () => {
      "worklet";
      scheduleOnRN(beginMotion);
    },
    onUpdate: (e) => {
      "worklet";
      const next = progressFromDrag(e.translationY, travel);
      if (crossedThreshold(progress.value, next, RELEASE_CONFIG) && !crossed.value) {
        crossed.value = true;
        scheduleOnRN(hapticThreshold);
      }
      progress.value = next;
    },
    onDeactivate: (e) => {
      "worklet";
      crossed.value = false;
      if (decideRelease(progress.value, e.velocityY, RELEASE_CONFIG) === "complete") {
        progress.value = withSpring(1, { ...SPRING, velocity: -e.velocityY / travel }, onDone);
      } else {
        progress.value = withSpring(0, SPRING, (done) => { if (done) scheduleOnRN(restoreGlass); });
      }
    },
  });

  useEffect(() => {
    if (phase !== "arrival") return;
    if (autoDiscover) {
      const timer = setTimeout(discover, AUTO_DISCOVER_MS);
      return () => clearTimeout(timer);
    }
    if (reducedMotion) return;
    // Toute première arrivée : un léger rebond de la carte suggère le geste, une seule fois (le verre reste).
    let cancelled = false;
    void readHintShown().then((shown) => {
      if (shown || cancelled) return;
      void writeHintShown();
      setTimeout(() => {
        if (!cancelled && progress.value === 0) {
          progress.value = withSequence(withTiming(HINT_PROGRESS, { duration: 320, easing: Easing.out(Easing.cubic) }), withSpring(0, SPRING));
        }
      }, HINT_DELAY_MS);
    });
    return () => { cancelled = true; };
    // discover est stable pour une vue donnée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDiscover, phase, reducedMotion]);

  const darkGlass = darkGlassColor(accent, colors.ink, VEIL_INK);
  const darkenStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.85], [1, 0], "clamp") }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0], "clamp"),
    transform: [{ translateY: interpolate(progress.value, [0, 0.4], [0, -40], "clamp") }],
  }));
  // Zone de touche et contenu d'arrivée : taille du repos, suivent le haut de la carte.
  const followStyle = useAnimatedStyle(() => ({ transform: [{ translateY: cardRect(geometry, progress.value).y - geometry.rest.y }] }));
  const arrivalContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, ARRIVAL_FADE, [1, 0], "clamp"),
    transform: [{ translateY: interpolate(progress.value, ARRIVAL_FADE, [0, ARRIVAL_LIFT], "clamp") }],
  }));
  // Contenu de la nouvelle posé dès le départ à sa taille finale (la lettrine se mesure une fois), déplacé avec la carte.
  const storyContentStyle = useAnimatedStyle(() => {
    const rect = cardRect(geometry, progress.value);
    return {
      opacity: interpolate(progress.value, STORY_FADE, [0, 1], "clamp"),
      transform: [{ translateX: rect.x }, { translateY: rect.y - geometry.final.y + interpolate(progress.value, STORY_FADE, [STORY_RISE, 0], "clamp") }],
    };
  });
  const topBarStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, TOP_BAR_FADE, [0, 1], "clamp") }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (phase === "story") return <DailyStoryScreen view={view} userId={userId} />;

  // Voile sombre qui se dissipe (« le jour se lève ») : uniforme et sous le soleil du ciel dessiné,
  // en dégradé vertical (plus sombre en haut) sur une vraie image. Un seul calque plein écran, opacité seule.
  const veil = (
    <Animated.View style={[StyleSheet.absoluteFill, darkenStyle]} pointerEvents="none">
      {movesSun ? (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: VEIL_ACCENT }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, opacity: VEIL_INK }]} />
        </>
      ) : <ImageVeil accent={accent} ink={colors.ink} />}
    </Animated.View>
  );

  const arrival = (
    <View style={[styles.screen, { backgroundColor: accent }]}>
      <MotionBackdrop view={view} progress={progress} veil={veil} width={width} height={height} imageHeight={imageHeight} />

      <Animated.View style={[styles.header, { top: insets.top + space.xl }, headerStyle]} pointerEvents="none" shouldRasterizeIOS>
        <ArrivalHeader today={view.today} />
      </Animated.View>

      <Animated.View style={[styles.topBar, { top: insets.top + space.s }, topBarStyle]} pointerEvents="none">
        <ThemePill label={view.theme.label} accent={accent} />
        <View style={styles.topActions}>
          <GlassButton label="Garder"><BookmarkIcon color={colors.ink} /></GlassButton>
          <GlassButton label="Menu"><MenuIcon color={colors.ink} /></GlassButton>
        </View>
      </Animated.View>

      <CardPieces geometry={geometry} progress={progress} glassOn={glassOn} darkGlass={darkGlass} />
      <GlassCard geometry={geometry} progress={progress} glassOn={glassOn} blur={blur} darkGlass={darkGlass} />

      <Animated.View style={[styles.sheetContent, { top: geometry.final.y, width, height: height - geometry.final.y }, storyContentStyle]} pointerEvents="none" shouldRasterizeIOS>
        <SheetContent view={view} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.touch, { left: geometry.rest.x, top: geometry.rest.y, width: geometry.rest.w, height: geometry.rest.h }, followStyle]}>
          <Pressable style={styles.fill} onPress={discover} accessibilityRole="button" accessibilityLabel="Découvrir la nouvelle du jour" accessibilityHint="Ou tire la carte vers le haut">
            <Animated.View style={[styles.fill, arrivalContentStyle]} shouldRasterizeIOS>
              <ArrivalCardContent view={view} onDiscover={discover} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
      <PaperTexture />
    </View>
  );

  if (phase === "fading") {
    return (
      <View style={styles.screen}>
        <DailyStoryScreen view={view} userId={userId} />
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="none">{arrival}</Animated.View>
      </View>
    );
  }
  return arrival;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  header: { position: "absolute", left: space.l, right: space.l },
  topBar: { position: "absolute", left: space.l, right: space.l, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2 },
  topActions: { flexDirection: "row", gap: space.s },
  touch: { position: "absolute" },
  sheetContent: { position: "absolute", left: 0, paddingHorizontal: sheetStyle.paddingHorizontal, paddingTop: sheetStyle.paddingTop },
});
