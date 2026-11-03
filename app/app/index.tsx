import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { shouldShowArrival } from "@/lib/arrival.ts";
import { readArrivalSeen } from "@/lib/arrivalStore.ts";
import { loadDailyView, type DailyView } from "@/lib/stories.ts";
import { DailyFlow } from "@/screens/DailyFlow.tsx";
import { colors, space, type } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";

type State = { status: "loading" } | { status: "ready"; view: DailyView; showArrival: boolean } | { status: "error"; message: string };

/** Écran 3 puis 4 : Arrivée du jour à la première ouverture de la journée, puis la Nouvelle du jour. */
export default function Index() {
  // Démonstration : EXPO_PUBLIC_DEMO_ARRIVAL=show force l'arrivée, =auto lance aussi la transition.
  const demo = process.env.EXPO_PUBLIC_DEMO_ARRIVAL;
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    Promise.all([loadDailyView(), readArrivalSeen()])
      .then(([view, seen]) => setState({ status: "ready", view, showArrival: shouldShowArrival(seen, view.today) }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, []);

  if (state.status === "ready") {
    return <DailyFlow view={state.view} showArrival={state.showArrival || demo === "show" || demo === "auto"} autoDiscover={demo === "auto"} />;
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
