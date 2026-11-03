import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { bootstrap, type Bootstrap } from "@/lib/bootstrap.ts";
import { parseNotifyTime } from "@/lib/onboarding.ts";
import { OnboardingFlow } from "@/screens/onboarding/OnboardingFlow.tsx";
import { colors, space, type } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";

type State = { status: "loading" } | { status: "ready"; boot: Bootstrap } | { status: "error"; message: string };

/** Écrans 1 et 2. Variable de dev EXPO_PUBLIC_DEMO_ONBOARDING=show|time : rejoue l'onboarding (profil existant pré-rempli), `time` ouvre directement l'écran 2. */
export default function Onboarding() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    bootstrap()
      .then((boot) => setState({ status: "ready", boot }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, []);

  if (state.status === "ready") {
    const { user, themes, profile } = state.boot;
    const initial = profile ? { themes: profile.themes, ...parseNotifyTime(profile.notify_time) } : undefined;
    const initialStep = process.env.EXPO_PUBLIC_DEMO_ONBOARDING === "time" ? "time" : "themes";
    return <OnboardingFlow userId={user.id} themes={themes} initial={initial} initialStep={initialStep} onDone={() => router.replace("/")} />;
  }
  return (
    <View style={styles.center}>
      <PaperTexture />
      {state.status === "loading" ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.error}>{state.message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: space.l },
  error: { ...type.body, textAlign: "center" },
});
