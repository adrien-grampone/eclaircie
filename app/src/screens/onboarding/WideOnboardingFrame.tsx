import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Span } from "@/lib/fold.ts";
import { hapticTap } from "@/lib/haptics.ts";
import { colors, radius, sizes, space, type, type Palette } from "@/theme/tokens.ts";
import { CrossfadeSky } from "@/ui/CrossfadeSky.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Spread } from "@/ui/fold/Spread.tsx";

const TITLE_SIZE = 38;
/** Largeur maximale du contenu de la page droite (liste des thèmes, roues de l'heure). */
const CONTENT_MAX_WIDTH = 480;

interface Props {
  layout: { left: Span; gutter: Span; right: Span };
  palette: Palette;
  caption: string;
  titleMain: string;
  titleAccent: string;
  cta: string;
  ctaDisabled: boolean;
  onCta: () => void;
  children: ReactNode;
}

/**
 * Onboarding en double page (iPhone Duo déplié) : le ciel et le titre occupent la page gauche, le
 * contenu et le bouton la page droite, sur papier. Rien sur la pliure.
 */
export function WideOnboardingFrame({ layout, palette, caption, titleMain, titleAccent, cta, ctaDisabled, onCta, children }: Props) {
  const insets = useSafeAreaInsets();
  const titleTop = insets.top + space.xl;
  return (
    <View style={styles.screen}>
      <Spread
        layout={layout}
        left={
          <View style={styles.fill}>
            {/* Même matière que le splash : collines gouache texturées, bruit de valeur, grain, soleil mesuré. */}
            <CrossfadeSky palette={palette} gouache />
            <View style={[styles.titleBlock, { top: titleTop, left: insets.left + space.xl }]} pointerEvents="none">
              <Text style={[type.caption, styles.caption]}>{caption}</Text>
              <Text style={styles.title}>
                <Text style={[type.title, styles.titleText]}>{titleMain}</Text>
                <Text style={[type.titleAccent, styles.titleText]}>{` ${titleAccent}`}</Text>
              </Text>
            </View>
          </View>
        }
        right={
          <View style={[styles.page, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.l, paddingLeft: space.xl, paddingRight: insets.right + space.xl }]}>
            <View style={styles.column}>
              <View style={styles.content}>{children}</View>
              <Pressable
                style={[styles.cta, ctaDisabled ? styles.ctaDisabled : null]} disabled={ctaDisabled}
                onPressIn={hapticTap} onPress={onCta} accessibilityRole="button" accessibilityState={{ disabled: ctaDisabled }}>
                <Text style={[type.button, { color: colors.paper }]}>{cta}</Text>
              </Pressable>
            </View>
          </View>
        }
      />
      <PaperTexture />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  titleBlock: { position: "absolute", right: space.xl },
  caption: { color: colors.ink, marginBottom: space.s },
  title: { fontSize: TITLE_SIZE, lineHeight: Math.round(TITLE_SIZE * 1.04) },
  titleText: { color: colors.ink, fontSize: TITLE_SIZE, lineHeight: Math.round(TITLE_SIZE * 1.04) },
  page: { flex: 1, backgroundColor: colors.paper },
  column: { flex: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH },
  content: { flex: 1 },
  cta: { height: sizes.button, borderRadius: radius.button, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: space.s },
  ctaDisabled: { opacity: 0.35 },
});
