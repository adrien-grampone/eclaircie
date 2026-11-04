import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { demo as demoVar } from "@/lib/demo.ts";
import { PLANETE_PALETTE } from "@/lib/splash.ts";
import { settleSplash, type SplashOutcome } from "@/lib/splashStore.ts";
import { Splash } from "@/screens/Splash.tsx";
import { colors } from "@/theme/tokens.ts";

/** Délai avant que les « données du jour » arrivent, pour voir la tenue de la dernière image. */
const DATA_MS = 1400;
const REPLAY_MS = 1200;

/**
 * Dev seulement : rejoue le splash animé en boucle sans relancer l'app (exp://…/--/dev/splash),
 * avec la palette Planète et des données qui arrivent à DATA_MS. EXPO_PUBLIC_DEMO_SPLASH=loop y
 * envoie dès le démarrage, =hold tient la dernière image pour l'examiner.
 */
export default function DevSplash() {
  const [run, setRun] = useState(0);
  const [outcome, setOutcome] = useState<SplashOutcome | null>(null);
  const hold = demoVar("splash") === "hold";
  useEffect(() => { settleSplash({ kind: "fade" }); }, []);
  useEffect(() => {
    setOutcome(null);
    if (hold) return;
    const timer = setTimeout(() => setOutcome({ kind: "arrival", palette: PLANETE_PALETTE }), DATA_MS);
    return () => clearTimeout(timer);
  }, [run, hold]);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>dev/splash · run {run} · {outcome ? outcome.kind : "en attente"}</Text>
      <Splash key={run} palette={PLANETE_PALETTE} outcome={outcome} onFirstFrame={() => Promise.resolve()}
        onDone={() => setTimeout(() => setRun((r) => r + 1), REPLAY_MS)} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.paper, justifyContent: "center", alignItems: "center" }, label: { color: colors.ink } });
