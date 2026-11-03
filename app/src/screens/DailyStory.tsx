import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DailyView } from "@/lib/stories.ts";
import { colors, radius, space } from "@/theme/tokens.ts";
import { GlassButton, ThemePill } from "@/ui/Glass.tsx";
import { BookmarkIcon, MenuIcon } from "@/ui/Icons.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Backdrop } from "./story/Backdrop.tsx";
import { SheetContent } from "./story/StoryContent.tsx";

/** Part de l'écran occupée par l'illustration avant que la feuille crème ne commence. */
export const IMAGE_SHARE = 0.47;
/** Parallaxe de l'illustration quand la feuille défile par-dessus (fraction du défilement). */
const PARALLAX = 0.3;

/** Hauteur de la zone d'illustration et ordonnée du haut de la feuille, pour une hauteur d'écran. */
export function sheetLayout(height: number): { imageHeight: number; sheetTop: number } {
  const imageHeight = Math.round(height * IMAGE_SHARE) + radius.sheet;
  return { imageHeight, sheetTop: imageHeight - radius.sheet };
}

/**
 * Nouvelle du jour. Tout ce qui dépend du défilement passe par le fil UI (useAnimatedScrollHandler) :
 * aucun setState pendant le scroll. La texture papier est une seule image posée au-dessus de tout.
 */
export function DailyStoryScreen({ view }: { view: DailyView }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { imageHeight, sheetTop } = sheetLayout(height);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const backdropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, imageHeight], [0, -imageHeight * PARALLAX], "clamp") }],
  }));
  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.illustration, { height: imageHeight }, backdropStyle]}>
        <Backdrop view={view} />
      </Animated.View>
      <View style={[styles.topBar, { top: insets.top + space.s }]}>
        <ThemePill label={view.theme.label} accent={view.theme.palette.accent} />
        <View style={styles.topActions}>
          <GlassButton label="Garder"><BookmarkIcon color={colors.ink} /></GlassButton>
          <GlassButton label="Menu"><MenuIcon color={colors.ink} /></GlassButton>
        </View>
      </View>
      <Animated.ScrollView style={styles.scroll} contentContainerStyle={{ paddingTop: sheetTop }} showsVerticalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never">
        <View style={[styles.sheet, { minHeight: height - sheetTop, paddingBottom: insets.bottom + space.xl }]}>
          <SheetContent view={view} />
        </View>
      </Animated.ScrollView>
      <PaperTexture />
    </View>
  );
}

/** Feuille crème : fond opaque et coins arrondis en haut (l'ombre reçoit alors un tracé natif, peu coûteux). */
export const sheetStyle = {
  backgroundColor: colors.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
  paddingHorizontal: space.l, paddingTop: space.xl,
  shadowColor: colors.ink, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  illustration: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
  topBar: { position: "absolute", left: space.l, right: space.l, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2 },
  topActions: { flexDirection: "row", gap: space.s },
  scroll: { flex: 1 },
  sheet: sheetStyle,
});
