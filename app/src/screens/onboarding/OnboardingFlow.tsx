import { useState } from "react";
import { Alert } from "react-native";
import { requestNotificationPermission, scheduleDailyNotification } from "@/lib/notifications.ts";
import { DEFAULT_NOTIFY, toggleTheme, validateProfile } from "@/lib/onboarding.ts";
import { deviceTimezone, saveProfile } from "@/lib/profile.ts";
import type { Theme } from "@/types.ts";
import { ThemesStep } from "./ThemesStep.tsx";
import { TimeStep } from "./TimeStep.tsx";

interface Props {
  userId: string;
  themes: readonly Theme[];
  /** Profil existant (variable de dev) : la sélection repart de lui. */
  initial?: { themes: readonly string[]; hour: number; minute: number } | undefined;
  /** Étape de départ (variable de dev pour capturer l'écran 2 directement). */
  initialStep?: "themes" | "time";
  onDone: () => void;
}

/**
 * Onboarding (écrans 1 et 2) : choix des thèmes, heure du rendez-vous, puis autorisation des
 * notifications À CE MOMENT-LÀ, programmation locale et écriture du profil. Un refus ne bloque pas.
 */
export function OnboardingFlow({ userId, themes, initial, initialStep = "themes", onDone }: Props) {
  const [step, setStep] = useState<"themes" | "time">(initialStep);
  const [selected, setSelected] = useState<readonly string[]>(initial?.themes ?? []);
  const [lastTouched, setLastTouched] = useState<Theme | null>(null);
  const [time, setTime] = useState({ hour: initial?.hour ?? DEFAULT_NOTIFY.hour, minute: initial?.minute ?? DEFAULT_NOTIFY.minute });
  const [busy, setBusy] = useState(false);

  const firstSelected = themes.find((t) => selected.includes(t.id));
  const palette = (lastTouched ?? firstSelected ?? themes[0])?.palette;
  if (!palette) return null;

  const toggle = (theme: Theme) => {
    setSelected((current) => toggleTheme(current, theme));
    setLastTouched(theme);
  };

  const confirm = async () => {
    const validation = validateProfile({ themes: selected, ...time, timezone: deviceTimezone() }, themes);
    if (!validation.ok) {
      Alert.alert("Profil incomplet", validation.reason);
      return;
    }
    setBusy(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) await scheduleDailyNotification(time.hour, time.minute);
      await saveProfile(userId, validation.row);
      onDone();
    } catch (cause) {
      Alert.alert("Enregistrement impossible", cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (step === "themes") {
    return <ThemesStep themes={themes} selected={selected} palette={palette} onToggle={toggle} onContinue={() => setStep("time")} />;
  }
  return <TimeStep palette={palette} hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} onConfirm={() => void confirm()} busy={busy} />;
}
