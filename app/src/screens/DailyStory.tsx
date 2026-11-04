import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DailyView } from "@/lib/stories.ts";
import { colors, radius, space } from "@/theme/tokens.ts";
import { GlassButton, ThemePill } from "@/ui/Glass.tsx";
import { BackIcon, BookmarkFilledIcon, BookmarkIcon, MenuIcon } from "@/ui/Icons.tsx";
import { MenuSheet } from "@/ui/MenuSheet.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Backdrop } from "./story/Backdrop.tsx";
import { SheetContent } from "./story/StoryContent.tsx";
import { useSaved } from "./story/useSaved.ts";
import { useShareCard } from "./story/useShareCard.tsx";
import { ReportSheet } from "@/ui/ReportSheet.tsx";

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
/** `onBack` : écran ouvert depuis les Archives ou les Gardées (bouton retour à la place du menu). */
export function DailyStoryScreen({ view, userId, onBack }: { view: DailyView; userId: string; onBack?: () => void }) {
  const { height } = useWindowDimensions();
  const story = view.pick.story;
  const bookmark = useSaved(userId, story?.id ?? null);
  const [menu, setMenu] = useState(false);
  const shareCard = useShareCard(view, story);
  const [reporting, setReporting] = useState(false);
  const actions = { share: shareCard.share, report: () => setReporting(true) };
  useEffect(() => {
    // Démonstration : capture la carte au chargement pour vérifier le fichier exporté.
    if (process.env.EXPO_PUBLIC_DEMO_SHARE === "capture") setTimeout(shareCard.share, 1500);
    if (process.env.EXPO_PUBLIC_DEMO_REPORT === "show") setTimeout(() => setReporting(true), 4000);
    // EXPO_PUBLIC_DEMO_SAVE=on : appuie sur le signet au chargement (même bascule que le bouton).
    if (process.env.EXPO_PUBLIC_DEMO_SAVE === "on") setTimeout(bookmark.toggle, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const insets = useSafeAreaInsets();
  const { imageHeight, sheetTop } = sheetLayout(height);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const backdropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, imageHeight], [0, -imageHeight * PARALLAX], "clamp") }],
  }));
  return (
    <View style={styles.screen}>
      {shareCard.element}
      <Animated.View style={[styles.illustration, { height: imageHeight }, backdropStyle]}>
        <Backdrop view={view} />
      </Animated.View>
      <View style={[styles.topBar, { top: insets.top + space.s }]}>
        <View style={styles.topActions}>
          {onBack ? <GlassButton label="Retour" onPress={onBack}><BackIcon color={colors.ink} /></GlassButton> : null}
          <ThemePill label={view.theme.label} accent={view.theme.palette.accent} />
        </View>
        <View style={styles.topActions}>
          {story ? (
            <GlassButton label={bookmark.saved ? "Ne plus garder" : "Garder"} onPress={bookmark.toggle}>
              {bookmark.saved ? <BookmarkFilledIcon color={colors.ink} /> : <BookmarkIcon color={colors.ink} />}
            </GlassButton>
          ) : null}
          {onBack ? null : <GlassButton label="Menu" onPress={() => setMenu(true)}><MenuIcon color={colors.ink} /></GlassButton>}
        </View>
      </View>
      <Animated.ScrollView style={styles.scroll} contentContainerStyle={{ paddingTop: sheetTop }} showsVerticalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never">
        <View style={[styles.sheet, { minHeight: height - sheetTop, paddingBottom: insets.bottom + space.xl }]}>
          <SheetContent view={view} actions={actions} />
        </View>
      </Animated.ScrollView>
      <PaperTexture />
      {story ? <ReportSheet visible={reporting} userId={userId} storyId={story.id} onClose={() => setReporting(false)} /> : null}
      <MenuSheet visible={menu} onClose={() => setMenu(false)} />
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
