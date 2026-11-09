import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { Span } from "@/lib/fold.ts";
import { colors } from "@/theme/tokens.ts";

type SpreadLayout = { left: Span; gutter: Span; right: Span };

/** Ombre de gouttière : un dégradé très léger, sombre au creux du pli, jamais interactif. */
const GUTTER_SHADOW = ["rgba(31,27,22,0)", "rgba(31,27,22,0.06)", "rgba(31,27,22,0)"] as const;
/** L'ombre déborde un peu sur chaque page, comme le creux d'un livre ouvert. */
const SHADOW_SPILL = 10;

/**
 * Double page : `left` et `right` occupent chacune leur page, la gouttière (sur la pliure) reste vide et
 * porte une ombre douce. Rien n'est posé sur le pli. `gutterColor` : fond de la gouttière.
 */
export function Spread({ layout, left, right, gutterColor = colors.paper }: { layout: SpreadLayout; left: ReactNode; right: ReactNode; gutterColor?: string }) {
  const { gutter } = layout;
  return (
    <View style={styles.root}>
      <View style={[styles.page, { left: layout.left.x, width: layout.left.width }]}>{left}</View>
      <View style={[styles.page, { left: gutter.x, width: gutter.width, backgroundColor: gutterColor }]} pointerEvents="none" />
      <View style={[styles.page, { left: layout.right.x, width: layout.right.width }]}>{right}</View>
      <GutterShadow gutter={gutter} />
    </View>
  );
}

export function GutterShadow({ gutter }: { gutter: Span }) {
  return (
    <LinearGradient colors={GUTTER_SHADOW} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} pointerEvents="none"
      style={[styles.page, { left: gutter.x - SHADOW_SPILL, width: gutter.width + 2 * SHADOW_SPILL }]} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
});
