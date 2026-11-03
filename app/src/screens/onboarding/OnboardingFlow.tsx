import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { requestNotificationPermission, scheduleDailyNotification } from "@/lib/notifications.ts";
import { DEFAULT_NOTIFY, paletteThemeId, toggleTheme, validateProfile } from "@/lib/onboarding.ts";
import { deviceTimezone, saveProfile } from "@/lib/profile.ts";
import type { Theme } from "@/types.ts";
import { ThemesStep } from "./ThemesStep.tsx";
import { TimeStep } from "./TimeStep.tsx";

interface Props {
  userId: string;
  themes: readonly Theme[];
  /** Étape de départ (variable de dev pour capturer l'écran 2 directement). */
  initialStep?: "themes" | "time";
  /** Démonstration : joue le parcours tout seul (coches, décoche, heure, validation). */
  autoplay?: boolean;
  onDone: () => void;
}

/** Scénario de démonstration : [délai en ms, action]. */
type Scripted = (actions: { toggle: (index: number) => void; next: () => void; hour: (hour: number) => void; confirm: () => void }) => void;
const AUTOPLAY: [number, Scripted][] = [
  [1200, (a) => a.toggle(0)], [1900, (a) => a.toggle(2)], [2600, (a) => a.toggle(1)], [3400, (a) => a.toggle(2)],
  [4400, (a) => a.next()], [5600, (a) => a.hour(9)], [6800, (a) => a.confirm()],
];

/**
 * Onboarding (écrans 1 et 2) : choix des thèmes (aucun coché au départ), heure du rendez-vous, puis
 * autorisation des notifications À CE MOMENT-LÀ, programmation locale et écriture du profil.
 * Un refus ne bloque pas.
 */
export function OnboardingFlow({ userId, themes, initialStep = "themes", autoplay = false, onDone }: Props) {
  const [step, setStep] = useState<"themes" | "time">(initialStep);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [time, setTime] = useState<{ hour: number; minute: number }>({ ...DEFAULT_NOTIFY });
  const [busy, setBusy] = useState(false);

  const paletteId = paletteThemeId(selected, themes[0]?.id);
  const palette = themes.find((t) => t.id === paletteId)?.palette;

  const toggle = (theme: Theme) => setSelected((current) => toggleTheme(current, theme));

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

  // Le scénario de démonstration lit toujours la version courante de confirm (sinon fermeture obsolète).
  const latest = useRef(confirm);
  latest.current = confirm;
  useEffect(() => {
    if (!autoplay) return;
    const selectable = themes.filter((t) => t.active && !t.coming_soon);
    const timers = AUTOPLAY.map(([delay, run]) => setTimeout(() => run({
      toggle: (index) => { const theme = selectable[index]; if (theme) toggle(theme); },
      next: () => setStep("time"),
      hour: (hour) => setTime((t) => ({ ...t, hour })),
      confirm: () => void latest.current(),
    }), delay));
    return () => timers.forEach(clearTimeout);
    // Le scénario ne dépend que du montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  if (!palette) return null;
  if (step === "themes") {
    return <ThemesStep themes={themes} selected={selected} palette={palette} onToggle={toggle} onContinue={() => setStep("time")} />;
  }
  return <TimeStep palette={palette} hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} onConfirm={() => void confirm()} busy={busy} />;
}
