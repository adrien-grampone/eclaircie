import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticTap } from "@/lib/haptics.ts";
import { colors, fonts, radius, sizes, space, type } from "@/theme/tokens.ts";
import { BackIcon } from "./Icons.tsx";
import { PaperTexture } from "./PaperTexture.tsx";
import { useFold } from "./fold/FoldProvider.tsx";
import { GutterShadow, Spread } from "./fold/Spread.tsx";
import { IllustratedPage } from "./fold/IllustratedPage.tsx";
import { useTodayView } from "@/lib/useTodayView.ts";

interface Props {
  title: string;
  /** Double page : la liste (StoryList) court sur les deux pages en grille ; sinon le contenu va à droite. */
  grid?: boolean;
  children: ReactNode;
}

/**
 * Cadre des écrans secondaires : fond papier, bouton retour, grand titre, contenu. En double page
 * (iPhone Duo déplié), la page gauche porte l'illustration du thème du jour et le titre ; le contenu occupe
 * la page droite. En grille (`grid`, Archives et Gardées), titre en haut à gauche et une colonne par page.
 * Rien sur la pliure.
 */
export function ListScreen({ title, grid = false, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fold = useFold();
  const today = useTodayView(fold.kind === "spread" && !grid);
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.s }, fold.kind === "spread" ? { paddingLeft: insets.left + space.xl } : null]}>
      <Pressable style={styles.back} onPressIn={hapticTap} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8}>
        <BackIcon color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
  if (fold.kind === "spread" && grid) {
    return (
      <View style={styles.screen}>
        <View style={{ width: fold.left.width }}>{header}</View>
        <View style={styles.content}>{children}</View>
        <GutterShadow gutter={fold.gutter} />
        <PaperTexture />
      </View>
    );
  }
  if (fold.kind === "spread") {
    return (
      <View style={styles.screen}>
        <Spread layout={fold} left={<IllustratedPage view={today} header={header} />} right={<View style={[styles.content, { paddingTop: insets.top + space.xl, paddingRight: insets.right }]}>{children}</View>} />
        <PaperTexture />
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.content}>{children}</View>
      <PaperTexture />
    </View>
  );
}

/** État vide soigné : un titre en Fraunces et une phrase. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[type.body, styles.emptyBody]}>{body}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={styles.empty}><ActivityIndicator color={colors.ink} /></View>;
}

export function ErrorState({ message }: { message: string }) {
  return <View style={styles.empty}><Text style={[type.body, styles.emptyBody]}>{message}</Text></View>;
}

/** Bouton « Voir plus » en bas d'une liste paginée. */
export function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.more} onPressIn={hapticTap} onPress={onPress} accessibilityRole="button">
      <Text style={[type.button, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Intertitre de section d'une liste (« Aussi aujourd'hui », « Les jours passés »). */
export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: space.l, paddingBottom: space.s, gap: space.s },
  back: { width: sizes.glassButton - 8, height: sizes.glassButton - 8, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(31,27,22,0.06)", marginLeft: -6 },
  title: { fontFamily: fonts.title, fontSize: 36, lineHeight: 40, color: colors.ink },
  content: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.s },
  emptyTitle: { fontFamily: fonts.title, fontSize: 26, lineHeight: 30, color: colors.ink, textAlign: "center" },
  emptyBody: { textAlign: "center" },
  more: { alignSelf: "center", height: sizes.button, paddingHorizontal: space.xl, borderRadius: radius.button, borderWidth: 1.5, borderColor: "rgba(31,27,22,0.25)", alignItems: "center", justifyContent: "center", marginVertical: space.l },
  section: { ...type.caption, marginTop: space.l, marginBottom: space.s },
});
