import { Image } from "expo-image";
import { forwardRef, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SHARE_CARD, shareCardContent } from "@/lib/shareCard.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, fonts, radius, space, type } from "@/theme/tokens.ts";
import { Sky, type SkyLayout } from "./Sky.tsx";

/** Ciel dessiné au format carte (maquette 04) : soleil haut à droite, collines qui occupent le tiers bas. */
const CARD_SKY: SkyLayout = { sun: { top: "25%", right: "20%", size: 125 }, hills: [403, 333, 278] };
/** Assombrissement du bas de la carte, en bandes, pour la lisibilité du titre crème. */
const SHADE_BANDS = 14;
const SHADE_START = 0.42;
const SHADE_MAX = 0.6;

type Story = NonNullable<DailyView["pick"]["story"]>;

interface Props {
  story: Story;
  view: DailyView;
  /** Appelé quand l'illustration est affichée (tout de suite pour le ciel dessiné) : la capture peut partir. */
  onReady: () => void;
}

/**
 * Carte story 390×693 points, fidèle à la maquette 04 : illustration (ou image de secours, ou ciel
 * dessiné), nom de l'app et accroche en haut, pastille du thème, titre en deux parties, source et
 * slogan en bas. Rendue hors de vue puis capturée en PNG.
 */
export const ShareCard = forwardRef<ComponentRef<typeof View>, Props>(function ShareCard({ story, view, onReady }, ref) {
  const { theme, image } = view;
  const card = shareCardContent(story, theme.label);
  const title = { fontSize: card.titleFontSize, lineHeight: Math.round(card.titleFontSize * 1.04) };
  return (
    <View ref={ref} collapsable={false} style={styles.card} {...(image ? {} : { onLayout: onReady })}>
      {image
        ? <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" onDisplay={onReady} />
        : <Sky palette={theme.palette} layout={CARD_SKY} />}
      <View style={styles.shade} pointerEvents="none">
        {Array.from({ length: SHADE_BANDS }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.ink, opacity: (SHADE_MAX * i) / (SHADE_BANDS - 1) }} />
        ))}
      </View>
      <View style={styles.top}>
        <Text style={styles.appName}>{card.appName}</Text>
        <Text style={[type.caption, { color: colors.ink }]}>{card.kicker}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: theme.palette.sun }]} />
          <Text style={styles.pillText}>{card.themeLabel}</Text>
        </View>
        <Text style={[styles.title, title]}>
          <Text style={[type.title, title, styles.cream]}>{card.titleMain}</Text>
          {card.titleAccent ? <Text style={[type.titleAccent, title, styles.cream]}>{` ${card.titleAccent}`}</Text> : null}
        </Text>
        <Text style={styles.source}>{card.source}</Text>
        <View style={styles.rule} />
        <View style={styles.footer}>
          <Text style={styles.tagline}>{card.tagline}</Text>
          <Text style={styles.brand}>{card.appName}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: SHARE_CARD.width, height: SHARE_CARD.height, overflow: "hidden", backgroundColor: colors.paper },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, top: `${SHADE_START * 100}%` },
  top: { position: "absolute", top: 34, left: space.l, right: space.l, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  appName: { fontFamily: fonts.title, fontSize: 28, color: colors.ink },
  bottom: { position: "absolute", left: space.l, right: space.l, bottom: 28 },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(245,239,228,0.45)", backgroundColor: "rgba(245,239,228,0.18)", marginBottom: space.m },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.paper },
  title: { marginBottom: space.s },
  cream: { color: colors.paper },
  source: { fontFamily: fonts.titleAccent, fontSize: 19, color: colors.paper, opacity: 0.92 },
  rule: { height: 1, backgroundColor: "rgba(245,239,228,0.35)", marginTop: space.l, marginBottom: space.m },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tagline: { fontFamily: fonts.body, fontSize: 16, color: colors.paper },
  brand: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.paper },
});
