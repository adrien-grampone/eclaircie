import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { demo as demoVar } from "@/lib/demo.ts";
import { publicImageUrl } from "@/lib/illustration.ts";
import { PLANETE_PALETTE } from "@/lib/splash.ts";
import { listFallbackFiles } from "@/lib/stories.ts";
import { bootOnce } from "@/lib/useBoot.ts";
import { settleSplash, type SplashOutcome } from "@/lib/splashStore.ts";
import { Splash } from "@/screens/Splash.tsx";
import { colors } from "@/theme/tokens.ts";

/** Délai avant que les « données du jour » arrivent, pour voir la tenue de la dernière image. */
const DATA_MS = 900;
const REPLAY_MS = 1200;

/**
 * Dev seulement : rejoue le splash animé en boucle sans relancer l'app (exp://…/--/dev/splash),
 * avec la palette Planète et des données qui arrivent à DATA_MS. EXPO_PUBLIC_DEMO_SPLASH=loop y
 * envoie dès le démarrage, =hold tient la dernière image pour l'examiner.
 */
export default function DevSplash() {
  const [run, setRun] = useState(0);
  const [outcome, setOutcome] = useState<SplashOutcome | null>(null);
  /** undefined tant que le bucket n'a pas répondu : l'issue n'est envoyée qu'une fois l'image connue. */
  const [image, setImage] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    settleSplash({ kind: "fade" });
    // Une image de secours Planète du bucket, comme l'arrivée en aurait une.
    void bootOnce().then(() => listFallbackFiles("planete")).then((files) => setImage(files[0] ? publicImageUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "", files[0]) : null)).catch(() => setImage(null));
  }, []);
  useEffect(() => {
    setOutcome(null);
    if (image === undefined) return;
    const timer = setTimeout(() => setOutcome({ kind: "arrival", palette: PLANETE_PALETTE, image }), DATA_MS);
    return () => clearTimeout(timer);
  }, [run, image]);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>dev/splash · run {run} · {outcome ? outcome.kind : "en attente"} · {image === undefined ? "image ?" : image ? "image" : "sans image"}</Text>
      <Splash key={run} palette={PLANETE_PALETTE} outcome={outcome} hold={demoVar("splash") === "hold"} onFirstFrame={() => Promise.resolve()}
        onDone={() => setTimeout(() => setRun((r) => r + 1), REPLAY_MS)} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.paper, justifyContent: "center", alignItems: "center" }, label: { color: colors.ink } });
