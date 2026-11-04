import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { shouldShowArrival } from "@/lib/arrival.ts";
import { readArrivalSeen } from "@/lib/arrivalStore.ts";
import { bootOnce } from "@/lib/useBoot.ts";
import { opensArrival, useLastNotificationResponse } from "@/lib/notifications.ts";
import { settleSplash, writeSplashPalette } from "@/lib/splashStore.ts";
import { loadDailyView, type DailyView } from "@/lib/stories.ts";
import { DailyFlow } from "@/screens/DailyFlow.tsx";
import { colors, space, type } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { demo as demoVar } from "@/lib/demo.ts";

type State =
  | { status: "loading" }
  | { status: "onboarding" }
  | { status: "ready"; view: DailyView; userId: string; showArrival: boolean }
  | { status: "error"; message: string };

/**
 * Entrée : un nouvel utilisateur (sans profil) passe par l'onboarding ; sinon Arrivée du jour à la
 * première ouverture de la journée (ou depuis la notification), puis la Nouvelle du jour.
 * Démonstration (dev seulement, voir lib/demo.ts) : EXPO_PUBLIC_DEMO_ARRIVAL=show force l'arrivée, =auto lance aussi la transition ;
 * EXPO_PUBLIC_DEMO_ONBOARDING=show|time|auto rejoue l'onboarding (`time` ouvre l'écran 2, `auto` joue le parcours seul).
 */
export default function Index() {
  const demo = demoVar("arrival");
  const demoOnboarding = ["show", "time", "auto"].includes(demoVar("onboarding") ?? "");
  const [state, setState] = useState<State>({ status: "loading" });
  const fromNotification = opensArrival(useLastNotificationResponse());
  useEffect(() => {
    if (demoOnboarding) {
      setState({ status: "onboarding" });
      return;
    }
    bootOnce()
      .then(async ({ user, themes, profile }) => {
        if (!profile) return { status: "onboarding" } as const;
        const [view, seen] = await Promise.all([loadDailyView(profile, themes), readArrivalSeen()]);
        return { status: "ready", view, userId: user.id, showArrival: shouldShowArrival(seen, view.today) } as const;
      })
      .then(setState)
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, [demoOnboarding]);

  const showArrival = state.status === "ready" && (state.showArrival || fromNotification || demo === "show" || demo === "auto");
  useEffect(() => {
    // Le splash animé attend cette décision : l'arrivée apparaît par-dessus sa dernière image, le reste en fondu.
    if (state.status === "loading") return;
    if (state.status === "ready" && showArrival) {
      settleSplash({ kind: "arrival", palette: state.view.theme.palette, image: state.view.image?.url ?? null });
      void writeSplashPalette(state.view.theme.palette);
    } else settleSplash({ kind: "fade" });
  }, [state, showArrival]);

  if (["loop", "hold"].includes(demoVar("splash") ?? "")) return <Redirect href="/dev/splash" />;
  if (state.status === "onboarding") return <Redirect href="/onboarding" />;
  if (state.status === "ready") {
    return <DailyFlow view={state.view} userId={state.userId} showArrival={showArrival} autoDiscover={demo === "auto"} />;
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
