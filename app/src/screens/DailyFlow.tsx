import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { readHintShown, writeArrivalSeen, writeHintShown } from "@/lib/arrivalStore.ts";
import { GLASS_TINT, cardColor, darkGlassColor } from "@/lib/color.ts";
import { RELEASE_CONFIG, crossedThreshold, decideRelease, progressFromDrag } from "@/lib/gesture.ts";
import { hapticLand, hapticThreshold } from "@/lib/haptics.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, glass, radius, space } from "@/theme/tokens.ts";
import { GlassButton, ThemePill } from "@/ui/Glass.tsx";
import { BookmarkIcon, MenuIcon } from "@/ui/Icons.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { ImageVeil } from "@/ui/Veil.tsx";
import { ARRIVAL_CARD_HEIGHT, ArrivalCardContent, ArrivalHeader } from "./Arrival.tsx";
import { DailyStoryScreen, sheetLayout, sheetStyle } from "./DailyStory.tsx";
import { Backdrop } from "./story/Backdrop.tsx";
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
 * Ciel DESSINÉ seulement : à l'arrivée, le fond occupe tout l'écran, agrandi et décalé vers le bas pour
 * que le soleil soit bas. Pendant la transition il reprend la hauteur et l'échelle de l'écran Nouvelle :
 * le soleil monte. Avec une vraie image, le soleil en fait partie : l'image entière remonte et se
 * recadre (hauteur animée, cadrage « cover ») pendant que le voile se dissipe.
 */
const SUN_DROP = 0.2;
const SUN_ZOOM = 1.5;
/** Part du trajet au bout de laquelle la carte, d'abord en verre translucide, devient opaque. */
const GLASS_SOLID_AT = 0.12;
/** Part du trajet au bout de laquelle le flou (et le liseré) du verre a disparu. */
const BLUR_END = 0.35;
/**
 * Contenus, SANS chevauchement : celui de l'arrivée glisse vers le haut en s'effaçant (0 → 25 %), puis
 * la nouvelle apparaît de 30 à 70 % avec un léger glissement depuis le bas. Le court instant sur la
 * carte crème unie est voulu.
 */
const ARRIVAL_FADE = [0, 0.25] as const;
const ARRIVAL_LIFT = -48;
const STORY_FADE = [0.3, 0.7] as const;
const STORY_RISE = 12;
/** Part du trajet au bout de laquelle le bas de la carte est passé sous le bord de l'écran. */
const BOTTOM_END = 0.2;
/** Voile sombre de l'arrivée sur le ciel dessiné (uniforme, sous le soleil) : part d'accent et part d'encre. */
const VEIL_ACCENT = 0.5;
const VEIL_INK = 0.2;

interface Props {
  view: DailyView;
  showArrival: boolean;
  autoDiscover?: boolean;
}

/**
 * Arrivée du jour → Nouvelle du jour (spec §8) : le fond assombri remonte (le soleil monte), les
 * textes d'accueil s'effacent, la carte en verre glisse et devient la feuille crème, puis l'écran
 * réel, défilable, prend le relais au pixel près. Pilotée au doigt (tirer la carte vers le haut),
 * au tap (bouton Découvrir ou la carte), ou en simple fondu si « Réduire les animations » est actif.
 */
export function DailyFlow({ view, showArrival, autoDiscover = false }: Props) {
  const [phase, setPhase] = useState<"arrival" | "fading" | "story">(showArrival ? "arrival" : "story");
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const crossed = useSharedValue(false);
  const fade = useSharedValue(1);
  const { imageHeight, sheetTop } = sheetLayout(height);
  const accent = view.theme.palette.accent;
  const movesSun = view.image === null;
  const cardTop = height - insets.bottom - space.m - ARRIVAL_CARD_HEIGHT;
  /** Trajet de la carte vers le haut, du repos à la position de la feuille. */
  const travel = cardTop - sheetTop;

  const finish = () => {
    hapticLand();
    void writeArrivalSeen(view.today);
    setPhase("story");
  };
  const onDone = (done?: boolean) => {
    "worklet";
    if (done) scheduleOnRN(finish);
  };
  const discover = () => {
    if (reducedMotion) {
      setPhase("fading");
      fade.value = withTiming(0, { duration: FADE_MS }, (done) => { if (done) scheduleOnRN(finish); });
      return;
    }
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.inOut(Easing.cubic) }, onDone);
  };

  const pan = usePanGesture({
    enabled: !reducedMotion,
    activeOffsetY: [-8, 8],
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
        progress.value = withSpring(0, SPRING);
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
    // Toute première arrivée : un léger rebond de la carte suggère le geste, une seule fois.
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
  const screenStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [accent, colors.paper]) }));
  const backdropStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [height, imageHeight]),
    transform: movesSun
      ? [
          { translateY: interpolate(progress.value, [0, 1], [height * SUN_DROP, 0]) },
          { scale: interpolate(progress.value, [0, 1], [SUN_ZOOM, 1]) },
        ]
      : [],
  }));
  const darkenStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.85], [1, 0], "clamp") }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [1, 0], "clamp"),
    transform: [{ translateY: interpolate(progress.value, [0, 0.4], [0, -40], "clamp") }],
  }));
  // Dès que la carte bouge, son bas passe sous le bord de l'écran : aucune bande visible sous la feuille.
  const cardStyle = useAnimatedStyle(() => ({
    top: interpolate(progress.value, [0, 1], [cardTop, sheetTop]),
    bottom: interpolate(progress.value, [0, BOTTOM_END], [insets.bottom + space.m, -radius.sheet], "clamp"),
    left: interpolate(progress.value, [0, 1], [space.m, 0]),
    width: interpolate(progress.value, [0, 1], [width - 2 * space.m, width]),
  }));
  // La carte ne passe jamais par la transparence : teinte du verre au repos, vite opaque, puis du verre
  // sombre au crème en OKLab (cardColor), l'essentiel du changement dans le premier quart du trajet.
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: cardColor(darkGlass, colors.paper, progress.value),
    opacity: interpolate(progress.value, [0, GLASS_SOLID_AT], [GLASS_TINT.alpha, 1], "clamp"),
  }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, BLUR_END], [1, 0], "clamp") }));
  const arrivalContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, ARRIVAL_FADE, [1, 0], "clamp"),
    transform: [{ translateY: interpolate(progress.value, ARRIVAL_FADE, [0, ARRIVAL_LIFT], "clamp") }],
  }));
  const storyContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, STORY_FADE, [0, 1], "clamp"),
    transform: [{ translateY: interpolate(progress.value, STORY_FADE, [STORY_RISE, 0], "clamp") }],
  }));
  const topBarStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.75, 1], [0, 1], "clamp") }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (phase === "story") return <DailyStoryScreen view={view} />;

  // Voile sombre qui se dissipe (« le jour se lève ») : uniforme et sous le soleil du ciel dessiné,
  // en dégradé vertical (plus sombre en haut) sur une vraie image.
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
    <Animated.View style={[styles.screen, screenStyle]}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Backdrop view={view} veil={veil} />
      </Animated.View>

      <Animated.View style={[styles.header, { top: insets.top + space.xl }, headerStyle]} pointerEvents="none">
        <ArrivalHeader today={view.today} />
      </Animated.View>

      <Animated.View style={[styles.topBar, { top: insets.top + space.s }, topBarStyle]} pointerEvents="none">
        <ThemePill label={view.theme.label} accent={accent} />
        <View style={styles.topActions}>
          <GlassButton label="Garder"><BookmarkIcon color={colors.ink} /></GlassButton>
          <GlassButton label="Menu"><MenuIcon color={colors.ink} /></GlassButton>
        </View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cardShadow, cardStyle]}>
          <Pressable style={styles.card} onPress={discover} accessibilityRole="button" accessibilityLabel="Découvrir la nouvelle du jour" accessibilityHint="Ou tire la carte vers le haut">
            <Animated.View style={[StyleSheet.absoluteFill, styles.glassLayer, blurStyle]}>
              <BlurView intensity={glass.intensity} tint="dark" style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, fillStyle]} />
            <Animated.View style={[styles.arrivalContent, arrivalContentStyle]}>
              <ArrivalCardContent view={view} onDiscover={discover} />
            </Animated.View>
            {/* Le contenu de la nouvelle est posé dès le départ à sa largeur finale (celle de l'écran), simplement
                découvert par la carte qui s'élargit : la lettrine se mesure une fois, à la bonne largeur. */}
            <Animated.View style={[styles.sheetContent, { width, height: height - sheetTop }, storyContentStyle]} pointerEvents="none">
              <SheetContent view={view} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
      <PaperTexture />
    </Animated.View>
  );

  if (phase === "fading") {
    return (
      <View style={styles.screen}>
        <DailyStoryScreen view={view} />
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]} pointerEvents="none">{arrival}</Animated.View>
      </View>
    );
  }
  return arrival;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backdrop: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
  header: { position: "absolute", left: space.l, right: space.l },
  topBar: { position: "absolute", left: space.l, right: space.l, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2 },
  topActions: { flexDirection: "row", gap: space.s },
  cardShadow: { position: "absolute", shadowColor: sheetStyle.shadowColor, shadowOffset: sheetStyle.shadowOffset, shadowOpacity: sheetStyle.shadowOpacity, shadowRadius: sheetStyle.shadowRadius },
  card: { flex: 1, borderRadius: radius.sheet, overflow: "hidden" },
  glassLayer: { borderRadius: radius.sheet, borderWidth: 1, borderColor: glass.border, overflow: "hidden" },
  /** Le contenu de la carte garde sa hauteur de repos, ancré en haut, pendant que la carte s'étire vers le bas. */
  arrivalContent: { position: "absolute", top: 0, left: 0, right: 0, height: ARRIVAL_CARD_HEIGHT },
  sheetContent: { position: "absolute", top: 0, left: 0, paddingHorizontal: sheetStyle.paddingHorizontal, paddingTop: sheetStyle.paddingTop },
});
