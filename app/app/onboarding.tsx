import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Bootstrap } from "@/lib/bootstrap.ts";
import { bootOnce, resetBoot } from "@/lib/useBoot.ts";
import { OnboardingFlow } from "@/screens/onboarding/OnboardingFlow.tsx";
import { colors, space, type } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";

type State = { status: "loading" } | { status: "ready"; boot: Bootstrap } | { status: "error"; message: string };

/** Écrans 1 et 2. Variable de dev EXPO_PUBLIC_DEMO_ONBOARDING=show|time|auto : rejoue l'onboarding, `time` ouvre l'écran 2, `auto` joue le parcours seul. */
export default function Onboarding() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    bootOnce()
      .then((boot) => setState({ status: "ready", boot }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, []);

  if (state.status === "ready") {
    const { user, themes } = state.boot;
    const demo = process.env.EXPO_PUBLIC_DEMO_ONBOARDING;
    return <OnboardingFlow userId={user.id} themes={themes} initialStep={demo === "time" ? "time" : "themes"} autoplay={demo === "auto"} onDone={() => { resetBoot(); router.replace("/"); }} />;
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
