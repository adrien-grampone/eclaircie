import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticTap } from "@/lib/haptics.ts";
import { colors, radius, sizes, space, type, type Palette } from "@/theme/tokens.ts";
import { CrossfadeSky } from "@/ui/CrossfadeSky.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { bannerSky } from "@/ui/Sky.tsx";
import { sheetStyle } from "../DailyStory.tsx";

/** Part de l'écran occupée par le bandeau de ciel (maquette 01). */
const BANNER_SHARE = 0.34;
const TITLE_SIZE = 38;

interface Props {
  palette: Palette;
  caption: string;
  titleMain: string;
  titleAccent: string;
  cta: string;
  ctaDisabled?: boolean;
  onCta: () => void;
  children: ReactNode;
}

/**
 * Cadre commun des écrans d'onboarding : ciel dessiné (palette qui se fond), titre en deux parties
 * posé sur le ciel, feuille crème avec son contenu et un bouton encre en bas.
 */
export function OnboardingFrame({ palette, caption, titleMain, titleAccent, cta, ctaDisabled = false, onCta, children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bannerHeight = Math.round(height * BANNER_SHARE) + radius.sheet;
  const titleTop = insets.top + space.xl;
  const [titleHeight, setTitleHeight] = useState(0);
  // Le soleil se cale sous le titre mesuré : il ne passe jamais derrière le texte.
  const layout = bannerSky(bannerHeight, titleTop + titleHeight + space.xs);
  return (
    <View style={styles.screen}>
      <View style={[styles.banner, { height: bannerHeight }]}>
        <CrossfadeSky palette={palette} layout={layout} />
      </View>
      <View style={[styles.titleBlock, { top: titleTop }]} pointerEvents="none" onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}>
        <Text style={[type.caption, styles.caption]}>{caption}</Text>
        <Text style={styles.title}>
          <Text style={[type.title, styles.titleText]}>{titleMain}</Text>
          <Text style={[type.titleAccent, styles.titleText]}>{` ${titleAccent}`}</Text>
        </Text>
      </View>
      <View style={[styles.sheet, { top: bannerHeight - radius.sheet, paddingBottom: insets.bottom + space.xs }]}>
        <View style={styles.content}>{children}</View>
        <Pressable
          style={[styles.cta, ctaDisabled ? styles.ctaDisabled : null]} disabled={ctaDisabled}
          onPressIn={hapticTap} onPress={onCta} accessibilityRole="button" accessibilityState={{ disabled: ctaDisabled }}>
          <Text style={[type.button, { color: colors.paper }]}>{cta}</Text>
        </Pressable>
      </View>
      <PaperTexture />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  banner: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
  titleBlock: { position: "absolute", left: space.l, right: space.l, zIndex: 1 },
  caption: { color: colors.ink, marginBottom: space.s },
  title: { fontSize: TITLE_SIZE, lineHeight: Math.round(TITLE_SIZE * 1.04) },
  titleText: { color: colors.ink, fontSize: TITLE_SIZE, lineHeight: Math.round(TITLE_SIZE * 1.04) },
  sheet: { ...sheetStyle, position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 20 },
  content: { flex: 1 },
  cta: { height: sizes.button, borderRadius: radius.button, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: space.s },
  ctaDisabled: { opacity: 0.35 },
});
