import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Backdrop } from "@/screens/story/Backdrop.tsx";
import type { DailyView } from "@/lib/stories.ts";

/** Voile papier léger, seulement derrière le titre (haut de page), qui s'efface vers le bas. */
const TITLE_VEIL = ["rgba(245,239,228,0.72)", "rgba(245,239,228,0.38)", "rgba(245,239,228,0)"] as const;
const TITLE_VEIL_HEIGHT = 190;

/**
 * Page gauche illustrée d'un écran secondaire en double page : l'illustration du thème du jour en pleine
 * page (comme la Nouvelle), le titre de l'écran par-dessus en haut, sur un voile léger limité au titre.
 * Sans illustration (chargement), le papier seul.
 */
export function IllustratedPage({ view, header }: { view: DailyView | null; header: ReactNode }) {
  return (
    <View style={styles.fill}>
      {view ? <Backdrop view={view} /> : null}
      {view ? <LinearGradient colors={TITLE_VEIL} style={styles.veil} pointerEvents="none" /> : null}
      {header}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  veil: { position: "absolute", left: 0, right: 0, top: 0, height: TITLE_VEIL_HEIGHT },
});
