import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { cardPieces, cardRect, motionTransform, rectMotion, type CardGeometry, type Rect } from "@/lib/arrivalMotion.ts";
import { GLASS_TINT, cardColor } from "@/lib/color.ts";
import { sheetStyle } from "@/screens/DailyStory.tsx";
import { absoluteFill, colors, glass, radius } from "@/theme/tokens.ts";

/** Part du trajet au bout de laquelle la carte, d'abord un aplat translucide, devient opaque. */
export const GLASS_SOLID_AT = 0.12;
/** Opacité de l'aplat qui remplace le verre dès que la carte bouge (équivalent visuel du verre teinté). */
export const FLAT_ALPHA = 0.85;
/** Fondu verre → aplat quand le mouvement commence, et aplat → verre quand la carte revient au repos. */
export const GLASS_SWAP_MS = 120;
export const GLASS_BACK_MS = 200;
/** Chevauchement des pièces de la carte (évite un liseré d'anticrénelage entre deux bords). */
const OVERLAP = 2;

interface Shared {
  geometry: CardGeometry;
  progress: SharedValue<number>;
  /** 1 = le verre (BlurView) est en place, 0 = remplacé par l'aplat. Piloté dans le temps, pas par le trajet. */
  glassOn: SharedValue<number>;
}

/**
 * Carte au REPOS : la vraie surface en verre (flou, liseré, teinte, ombre), à taille fixe. Elle ne fait
 * que suivre le haut de la carte (translate) et s'effacer dans le temps dès que le mouvement commence :
 * aucun BlurView ne survit à la transition. `blur` : le BlurView est monté (repos) ou non (mouvement).
 */
export function GlassCard({ geometry, progress, glassOn, blur, darkGlass }: Shared & { blur: boolean; darkGlass: string }) {
  const rest = geometry.rest;
  const style = useAnimatedStyle(() => ({
    opacity: glassOn.value,
    transform: [{ translateY: cardRect(geometry, progress.value).y - rest.y }],
  }));
  return (
    <Animated.View style={[styles.abs, rectStyle(rest), styles.glassShadow, style]} pointerEvents="none">
      <View style={styles.glass}>
        {blur ? <BlurView intensity={glass.intensity} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: darkGlass }]} />
      </View>
    </Animated.View>
  );
}

/**
 * Carte en MOUVEMENT, en trois pièces posées à leur taille finale et déplacées par transform :
 * calotte haute (coins arrondis, porte l'ombre de la feuille), corps, calotte basse. Couleur du verre
 * sombre au crème en OKLab, opacité de l'aplat à 1 dès GLASS_SOLID_AT. Invisible tant que le verre est là.
 * `darkGlass` : couleur du verre au repos (teinte sous le flou), point de départ de la couleur.
 */
export function CardPieces({ geometry, progress, glassOn, darkGlass }: Shared & { darkGlass: string }) {
  const finals = cardPieces(geometry.final, radius.sheet, OVERLAP);
  const usePiece = (key: "top" | "body" | "bottom") =>
    useAnimatedStyle(() => {
      const now = cardPieces(cardRect(geometry, progress.value), radius.sheet, OVERLAP);
      return {
        backgroundColor: cardColor(darkGlass, colors.paper, progress.value),
        opacity: (1 - glassOn.value) * interpolate(progress.value, [0, GLASS_SOLID_AT], [FLAT_ALPHA, 1], "clamp"),
        transform: motionTransform(rectMotion(finals[key], now[key])),
      };
    });
  const top = usePiece("top");
  const body = usePiece("body");
  const bottom = usePiece("bottom");
  return (
    <>
      {/* Le corps passe AU-DESSUS de la calotte haute : la part basse de son ombre reste cachée. */}
      <Animated.View style={[styles.abs, rectStyle(finals.top), styles.capTop, top]} pointerEvents="none" />
      <Animated.View style={[styles.abs, rectStyle(finals.body), body]} pointerEvents="none" />
      <Animated.View style={[styles.abs, rectStyle(finals.bottom), styles.capBottom, bottom]} pointerEvents="none" />
    </>
  );
}

function rectStyle(r: Rect) {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  glass: { ...absoluteFill, borderRadius: radius.sheet, borderWidth: 1, borderColor: glass.border, overflow: "hidden" },
  tint: { opacity: GLASS_TINT.alpha },
  glassShadow: { shadowColor: sheetStyle.shadowColor, shadowOffset: sheetStyle.shadowOffset, shadowOpacity: sheetStyle.shadowOpacity, shadowRadius: sheetStyle.shadowRadius },
  /* Fond opaque + coins arrondis : React Native donne à l'ombre un tracé natif, rien n'est recalculé par image. */
  capTop: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.paper, shadowColor: sheetStyle.shadowColor, shadowOffset: sheetStyle.shadowOffset, shadowOpacity: sheetStyle.shadowOpacity, shadowRadius: sheetStyle.shadowRadius },
  capBottom: { borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet },
});
