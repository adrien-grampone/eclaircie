import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { absoluteFill, glass, radius, sizes, space, type } from "@/theme/tokens.ts";

interface GlassProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
}

/** Surface en verre (spec §5) : flou ~40 et bordure blanche à 50 %, arrondie en pastille. */
export function Glass({ children, style, onPress, label }: GlassProps) {
  const content = (
    <BlurView intensity={glass.intensity} tint="light" style={[styles.glass, style]}>
      <View style={styles.tint} />
      {children}
    </BlurView>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>{content}</Pressable>;
}

/** Pastille du thème : point de la couleur d'accent + libellé. */
export function ThemePill({ label, accent }: { label: string; accent: string }) {
  return (
    <Glass style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={type.pill}>{label}</Text>
    </Glass>
  );
}

/** Bouton rond en verre, pour une icône. */
export function GlassButton({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label: string }) {
  return <Glass style={styles.round} onPress={onPress ?? (() => undefined)} label={label}>{children}</Glass>;
}

const styles = StyleSheet.create({
  glass: { overflow: "hidden", borderRadius: radius.pill, borderWidth: 1, borderColor: glass.border },
  tint: { ...absoluteFill, backgroundColor: glass.tint },
  pill: { flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.l, height: sizes.glassButton },
  dot: { width: 10, height: 10, borderRadius: 5 },
  round: { width: sizes.glassButton, height: sizes.glassButton, alignItems: "center", justifyContent: "center" },
});
