import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { loadDailyView, type DailyView } from "@/lib/stories.ts";
import { DailyStoryScreen } from "@/screens/DailyStory.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { colors, space, type } from "@/theme/tokens.ts";

type State = { status: "loading" } | { status: "ready"; view: DailyView } | { status: "error"; message: string };

/** Écran 4 : la Nouvelle du jour, sur les vraies données. */
export default function Index() {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    loadDailyView()
      .then((view) => setState({ status: "ready", view }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, []);

  if (state.status === "ready") return <DailyStoryScreen view={state.view} />;
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
