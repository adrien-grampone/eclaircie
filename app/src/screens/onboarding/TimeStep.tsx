import { StyleSheet, Text, View } from "react-native";
import { MINUTE_STEP, ONBOARDING_COPY, formatHour } from "@/lib/onboarding.ts";
import { colors, fonts, space, type, type Palette } from "@/theme/tokens.ts";
import { Wheel } from "@/ui/Wheel.tsx";
import { OnboardingFrame } from "./OnboardingFrame.tsx";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

interface Props {
  palette: Palette;
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  onConfirm: () => void;
  busy: boolean;
}

/** Écran 2 : sélecteur d'heure (molettes heures et minutes), la demande de notifications vient au bouton. */
export function TimeStep({ palette, hour, minute, onChange, onConfirm, busy }: Props) {
  return (
    <OnboardingFrame
      palette={palette} caption={ONBOARDING_COPY.timeCaption} titleMain={ONBOARDING_COPY.timeMain} titleAccent={ONBOARDING_COPY.timeAccent}
      cta={`${ONBOARDING_COPY.timeCta} · ${formatHour(hour, minute)}`} ctaDisabled={busy} onCta={onConfirm}>
      <Text style={[type.body, styles.help]}>{ONBOARDING_COPY.timeHelp}</Text>
      <View style={styles.wheels}>
        <Wheel values={HOURS} value={hour} onChange={(h) => onChange(h, minute)} format={(h) => `${h} h`} width={120} label="Heure" />
        <Wheel values={MINUTES} value={minute} onChange={(m) => onChange(hour, m)} format={(m) => String(m).padStart(2, "0")} width={90} label="Minutes" />
      </View>
      <Text style={styles.note}>Tu pourras changer d'avis à tout moment.</Text>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.ink, marginBottom: space.l },
  wheels: { flexDirection: "row", justifyContent: "center", gap: space.m, marginTop: space.m },
  note: { fontFamily: fonts.titleAccent, fontSize: 15, color: colors.caption, textAlign: "center", marginTop: space.l },
});
