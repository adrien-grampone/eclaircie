import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { notificationPermissionGranted, scheduleDailyNotification } from "@/lib/notifications.ts";
import { parseNotifyTime, validateProfile } from "@/lib/onboarding.ts";
import { saveProfile } from "@/lib/profile.ts";
import { planReschedule } from "@/lib/settings.ts";
import { resetBoot, useBoot } from "@/lib/useBoot.ts";
import type { Theme } from "@/types.ts";
import { ErrorState, Loading } from "@/ui/ListScreen.tsx";
import { TimeStep } from "../onboarding/TimeStep.tsx";

/** Réglages → Heure du rendez-vous : même sélecteur que l'onboarding, reprogramme la notification. */
export function EditTime() {
  const boot = useBoot();
  if (boot.status === "error") return <ErrorState message={boot.message} />;
  if (boot.status !== "ready" || !boot.boot.profile) return <Loading />;
  return <Editor themes={boot.boot.themes} userId={boot.boot.user.id} profile={boot.boot.profile} />;
}

function Editor({ themes, userId, profile }: { themes: readonly Theme[]; userId: string; profile: { themes: string[]; notify_time: string; timezone: string } }) {
  const router = useRouter();
  const previous = parseNotifyTime(profile.notify_time);
  const [time, setTime] = useState(previous);
  const [busy, setBusy] = useState(false);
  const palette = themes.find((t) => t.id === profile.themes[0])?.palette ?? themes[0]?.palette;
  if (!palette) return null;
  const confirm = async () => {
    const validation = validateProfile({ themes: profile.themes, ...time, timezone: profile.timezone }, themes);
    if (!validation.ok) return Alert.alert("Heure", validation.reason);
    setBusy(true);
    try {
      const plan = planReschedule(previous, time, await notificationPermissionGranted(), new Date());
      if (plan.action === "schedule") await scheduleDailyNotification(plan.hour, plan.minute);
      await saveProfile(userId, validation.row);
      resetBoot();
      router.back();
    } catch (cause) {
      Alert.alert("Enregistrement impossible", cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return <TimeStep palette={palette} hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} onConfirm={() => void confirm()} busy={busy} />;
}
