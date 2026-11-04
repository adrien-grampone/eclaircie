import { useRouter, type Href } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticTap } from "@/lib/haptics.ts";
import { absoluteFill, colors, fonts, radius, space } from "@/theme/tokens.ts";
import { ArchiveIcon, BookmarkIcon, ChevronIcon, GearIcon } from "./Icons.tsx";

const ENTRIES: { href: Href; label: string; Icon: (p: { color: string }) => React.JSX.Element }[] = [
  { href: "/archives", label: "Archives", Icon: ArchiveIcon },
  { href: "/saved", label: "Gardées", Icon: BookmarkIcon },
  { href: "/settings", label: "Réglages", Icon: GearIcon },
];

/** Menu : une feuille avec trois entrées, Archives, Gardées, Réglages. */
export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const go = (href: Href) => {
    onClose();
    router.push(href);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer le menu" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.m }]}>
          <View style={styles.handle} />
          {ENTRIES.map(({ href, label, Icon }) => (
            <Pressable key={label} style={styles.row} onPressIn={hapticTap} onPress={() => go(href)} accessibilityRole="button" accessibilityLabel={label}>
              <Icon color={colors.ink} />
              <Text style={styles.label}>{label}</Text>
              <ChevronIcon color={colors.caption} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...absoluteFill, backgroundColor: "rgba(31,27,22,0.35)" },
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.l, paddingTop: space.s },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(31,27,22,0.2)", marginBottom: space.s },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, height: 60, borderTopWidth: 1, borderColor: "rgba(31,27,22,0.12)" },
  label: { flex: 1, fontFamily: fonts.title, fontSize: 24, color: colors.ink },
});
