import { Pressable, StyleSheet, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { ARRIVAL_COPY } from "@/lib/arrival.ts";
import { formatDayLabel, readingMinutes, titleSize } from "@/lib/daily.ts";
import { hapticTap } from "@/lib/haptics.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, radius, sizes, space, type } from "@/theme/tokens.ts";

/** Hauteur de la carte d'arrivée en verre. */
export const ARRIVAL_CARD_HEIGHT = 250;

/** Textes du haut de l'écran d'arrivée : date, « Bonjour. », accroche en italique. */
export function ArrivalHeader({ today }: { today: string }) {
  const greeting = titleSize(ARRIVAL_COPY.greeting, null);
  return (
    <View>
      <Text style={[type.caption, styles.cream]}>{formatDayLabel(today)}</Text>
      <Text style={[type.title, { fontSize: greeting.fontSize + 20, lineHeight: greeting.lineHeight + 22 }, styles.cream, styles.greeting]}>{ARRIVAL_COPY.greeting}</Text>
      <Text style={[type.titleAccent, styles.cream, styles.tagline]}>{ARRIVAL_COPY.tagline}</Text>
    </View>
  );
}

/** Contenu de la carte en verre : thème et durée, promesse en deux parties, bouton Découvrir. */
/** `grow` : la carte prend la hauteur de son contenu (double page, page étroite) au lieu d'une hauteur fixe. */
export function ArrivalCardContent({ view, onDiscover, grow = false }: { view: DailyView; onDiscover: () => void; grow?: boolean }) {
  const minutes = view.pick.story ? readingMinutes(view.pick.story.summary) : 1;
  const title = titleSize(ARRIVAL_COPY.cardMain, ARRIVAL_COPY.cardAccent);
  return (
    <View style={[styles.card, grow ? styles.cardGrow : null]}>
      {grow ? null : <View style={styles.handle} accessible={false} />}
      <Text style={[type.caption, styles.cream]}>{view.theme.label.toUpperCase()} · {minutes} MIN</Text>
      <Text style={[styles.cardTitle, title]}>
        <Text style={[type.title, title, styles.cream]}>{ARRIVAL_COPY.cardMain}</Text>
        <Text style={[type.titleAccent, title, styles.cream]}>{` ${ARRIVAL_COPY.cardAccent}`}</Text>
      </Text>
      <Pressable style={styles.button} onPressIn={hapticTap} onPress={onDiscover} accessibilityRole="button" accessibilityLabel={ARRIVAL_COPY.cta}>
        <Text style={[type.button, { color: colors.ink }]}>{ARRIVAL_COPY.cta}</Text>
        <SymbolView name="arrow.right" tintColor={colors.ink} size={18} weight="medium" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cream: { color: colors.paper },
  greeting: { marginTop: space.s },
  tagline: { fontSize: 24, lineHeight: 30, marginTop: space.xs },
  card: { flex: 1, padding: space.l, justifyContent: "flex-end", gap: space.s },
  /** Base de hauteur naturelle : le contenu pousse la carte au lieu de déborder d'une hauteur fixe. */
  cardGrow: { flexBasis: "auto", paddingTop: space.xl },
  /** Poignée type feuille iOS : invite à tirer la carte vers le haut. */
  handle: { position: "absolute", top: space.s, alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(245,239,228,0.55)" },
  cardTitle: { marginBottom: space.xs },
  button: { height: sizes.button, borderRadius: radius.button, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s },
});
