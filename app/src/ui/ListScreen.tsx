import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticTap } from "@/lib/haptics.ts";
import { colors, fonts, radius, sizes, space, type } from "@/theme/tokens.ts";
import { BackIcon } from "./Icons.tsx";
import { PaperTexture } from "./PaperTexture.tsx";

interface Props {
  title: string;
  children: ReactNode;
}

/** Cadre des écrans secondaires : fond papier, bouton retour, grand titre, contenu. */
export function ListScreen({ title, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <Pressable style={styles.back} onPressIn={hapticTap} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8}>
          <BackIcon color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
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
