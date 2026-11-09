import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { READING_MAX_WIDTH, type Span } from "@/lib/fold.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, sizes, space } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Spread } from "@/ui/fold/Spread.tsx";
import { Backdrop } from "./Backdrop.tsx";

interface Props {
  layout: { left: Span; gutter: Span; right: Span };
  view: DailyView;
  /** Pastille du thème (et retour) : haut de la page gauche, sur l'illustration. */
  topLeft: ReactNode;
  /** Signet et menu : haut de la page droite. */
  topRight: ReactNode;
  /** Contenu de la feuille (date, titre, lettrine, résumé, source, boutons). */
  sheet: ReactNode;
  /** Partage, signalement, menu : couches modales. */
  overlays: ReactNode;
}

/**
 * Nouvelle en double page (iPhone Duo déplié) : l'illustration occupe toute la page gauche, en portrait
 * et en entier ; la feuille papier occupe la page droite, colonne de lecture plafonnée (~65 caractères).
 * Chaque page tient compte de ses propres zones sûres (rail de barre d'état à droite).
 */
export function WideStory({ layout, view, topLeft, topRight, sheet, overlays }: Props) {
  const insets = useSafeAreaInsets();
  const barTop = insets.top + space.s;
  return (
    <View style={styles.screen}>
      <Spread
        layout={layout}
        left={
          <View style={styles.fill}>
            <Backdrop view={view} />
            <View style={[styles.bar, { top: barTop, left: insets.left + space.l }]}>{topLeft}</View>
          </View>
        }
        right={
          <View style={styles.page}>
            <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
              contentContainerStyle={{ paddingTop: barTop + sizes.glassButton + space.l, paddingBottom: insets.bottom + space.xl, paddingLeft: space.xl, paddingRight: insets.right + space.xl }}>
              <View style={styles.column}>{sheet}</View>
            </ScrollView>
            <View style={[styles.bar, { top: barTop, right: insets.right + space.l }]}>{topRight}</View>
          </View>
        }
      />
      <PaperTexture />
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.paper },
  bar: { position: "absolute", flexDirection: "row", alignItems: "center", gap: space.s, zIndex: 2 },
  column: { width: "100%", maxWidth: READING_MAX_WIDTH },
});
