import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { paletteThemeId, parseNotifyTime, toggleTheme, validateProfile } from "@/lib/onboarding.ts";
import { saveProfile } from "@/lib/profile.ts";
import { resetBoot, useBoot } from "@/lib/useBoot.ts";
import type { Theme } from "@/types.ts";
import { ErrorState, Loading } from "@/ui/ListScreen.tsx";
import { ThemesStep } from "../onboarding/ThemesStep.tsx";

/** Réglages → Mes thèmes : l'écran des thèmes de l'onboarding, pré-rempli, bouton « Enregistrer ». */
export function EditThemes() {
  const boot = useBoot();
  if (boot.status === "error") return <ErrorState message={boot.message} />;
  if (boot.status !== "ready" || !boot.boot.profile) return <Loading />;
  return <Editor themes={boot.boot.themes} userId={boot.boot.user.id} profile={boot.boot.profile} />;
}

function Editor({ themes, userId, profile }: { themes: readonly Theme[]; userId: string; profile: { themes: string[]; notify_time: string; timezone: string } }) {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly string[]>(profile.themes);
  const palette = themes.find((t) => t.id === paletteThemeId(selected, themes[0]?.id))?.palette;
  if (!palette) return null;
  const save = async () => {
    const { hour, minute } = parseNotifyTime(profile.notify_time);
    const validation = validateProfile({ themes: selected, hour, minute, timezone: profile.timezone }, themes);
    if (!validation.ok) return Alert.alert("Thèmes", validation.reason);
    try {
      await saveProfile(userId, validation.row);
      resetBoot();
      router.back();
    } catch (cause) {
      Alert.alert("Enregistrement impossible", cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <ThemesStep
      themes={themes} selected={selected} palette={palette} onToggle={(t) => setSelected((c) => toggleTheme(c, t))}
      onContinue={() => void save()} ctaLabel={`Enregistrer · ${selected.length} thème${selected.length > 1 ? "s" : ""}`} />
  );
}
