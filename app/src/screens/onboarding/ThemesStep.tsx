import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { hapticTap } from "@/lib/haptics.ts";
import { ONBOARDING_COPY, continueLabel, isSelectable } from "@/lib/onboarding.ts";
import { colors, fonts, space, type, type Palette } from "@/theme/tokens.ts";
import type { Theme } from "@/types.ts";
import { OnboardingFrame } from "./OnboardingFrame.tsx";

interface Props {
  themes: readonly Theme[];
  selected: readonly string[];
  palette: Palette;
  onToggle: (theme: Theme) => void;
  onContinue: () => void;
  /** Réglages : libellé du bouton à la place de « Continuer · N thèmes ». */
  ctaLabel?: string;
}

/** Écran 1 : promesse, liste numérotée des thèmes (« bientôt » non sélectionnable), bouton Continuer. */
export function ThemesStep({ themes, selected, palette, onToggle, onContinue, ctaLabel }: Props) {
  const [before, strong, after] = ONBOARDING_COPY.promise;
  return (
    <OnboardingFrame
      palette={palette} caption={ONBOARDING_COPY.welcome} titleMain={ONBOARDING_COPY.titleMain} titleAccent={ONBOARDING_COPY.titleAccent}
      cta={selected.length === 0 || !ctaLabel ? continueLabel(selected.length) : ctaLabel} ctaDisabled={selected.length === 0} onCta={onContinue}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={[type.body, styles.promise]}>{before}<Text style={styles.strong}>{strong}</Text>{after}</Text>
        {themes.map((theme, index) => (
          <ThemeRow key={theme.id} theme={theme} index={index} checked={selected.includes(theme.id)} onToggle={onToggle} />
        ))}
      </ScrollView>
    </OnboardingFrame>
  );
}

function ThemeRow({ theme, index, checked, onToggle }: { theme: Theme; index: number; checked: boolean; onToggle: (theme: Theme) => void }) {
  const selectable = isSelectable(theme);
  return (
    <Pressable
      style={styles.row} disabled={!selectable} onPressIn={selectable ? hapticTap : undefined} onPress={() => onToggle(theme)}
      accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !selectable }} accessibilityLabel={theme.label}>
      <Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={[styles.label, checked ? styles.labelChecked : null, selectable ? null : styles.labelSoon]}>{theme.label}</Text>
      {selectable
        ? <View style={[styles.check, checked ? { backgroundColor: theme.palette.accent, borderColor: theme.palette.accent } : null]}>
            {checked ? <SymbolView name="checkmark" tintColor={colors.paper} size={13} weight="bold" /> : null}
          </View>
        : <Text style={styles.soon}>{ONBOARDING_COPY.soon}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  promise: { color: colors.ink, fontSize: 16, lineHeight: 22, marginBottom: space.s },
  strong: { fontFamily: fonts.bodyBold },
  row: { flexDirection: "row", alignItems: "center", height: 46, borderTopWidth: 1, borderColor: "rgba(31,27,22,0.14)" },
  number: { fontFamily: fonts.titleAccent, fontSize: 16, color: colors.caption, width: 44 },
  /** Non coché : encre, graisse normale. Coché : gras. Le gris est réservé à « bientôt ». */
  label: { flex: 1, fontFamily: fonts.titleRegular, fontSize: 25, color: colors.ink },
  labelChecked: { fontFamily: fonts.title },
  labelSoon: { color: colors.caption },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "rgba(31,27,22,0.28)", alignItems: "center", justifyContent: "center" },
  soon: { fontFamily: fonts.titleAccent, fontSize: 17, color: colors.caption },
});
