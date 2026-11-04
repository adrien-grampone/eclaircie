import { useRouter, type Href } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { hapticTap } from "@/lib/haptics.ts";
import { formatHour, parseNotifyTime } from "@/lib/onboarding.ts";
import { CONTACT_EMAIL, SETTINGS_COPY } from "@/lib/settings.ts";
import { useBoot } from "@/lib/useBoot.ts";
import { colors, fonts, space } from "@/theme/tokens.ts";
import { ChevronIcon } from "@/ui/Icons.tsx";
import { ListScreen } from "@/ui/ListScreen.tsx";

/** Écran 8 : thèmes, heure, méthode, contact. */
export function SettingsScreen() {
  const router = useRouter();
  const boot = useBoot();
  const profile = boot.status === "ready" ? boot.boot.profile : null;
  const themeLabels = boot.status === "ready" && profile
    ? boot.boot.themes.filter((t) => profile.themes.includes(t.id)).map((t) => t.label).join(", ")
    : "";
  const time = profile ? parseNotifyTime(profile.notify_time) : null;
  const rows: { label: string; detail: string; onPress: () => void }[] = [
    { label: SETTINGS_COPY.themes, detail: themeLabels, onPress: () => router.push("/settings/themes" as Href) },
    { label: SETTINGS_COPY.time, detail: time ? formatHour(time.hour, time.minute) : "", onPress: () => router.push("/settings/time" as Href) },
    { label: SETTINGS_COPY.method, detail: "", onPress: () => router.push("/settings/method" as Href) },
    { label: SETTINGS_COPY.contact, detail: CONTACT_EMAIL, onPress: () => void Linking.openURL(`mailto:${CONTACT_EMAIL}`) },
  ];
  return (
    <ListScreen title={SETTINGS_COPY.title}>
      <View style={styles.list}>
        {rows.map((row) => (
          <Pressable key={row.label} style={styles.row} onPressIn={hapticTap} onPress={row.onPress} accessibilityRole="button" accessibilityLabel={row.label}>
            <View style={styles.text}>
              <Text style={styles.label}>{row.label}</Text>
              {row.detail ? <Text style={styles.detail} numberOfLines={1}>{row.detail}</Text> : null}
            </View>
            <ChevronIcon color={colors.caption} />
          </Pressable>
        ))}
      </View>
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.l },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.m, borderTopWidth: 1, borderColor: "rgba(31,27,22,0.12)" },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.title, fontSize: 22, color: colors.ink },
  detail: { fontFamily: fonts.body, fontSize: 15, color: colors.caption },
});
