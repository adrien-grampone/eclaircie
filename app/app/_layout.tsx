import { Stack, usePathname, useRootNavigationState } from "expo-router";
import { Linking } from "react-native";
import { navLog } from "@/lib/navLog.ts";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { demo as demoVar } from "@/lib/demo.ts";
import { configureNotifications } from "@/lib/notifications.ts";
import { readSplashPalette, settleSplash, useSplashOutcome } from "@/lib/splashStore.ts";
import { Splash } from "@/screens/Splash.tsx";
import { useAppFonts } from "@/theme/fonts.ts";
import { FpsOverlay } from "@/ui/FpsOverlay.tsx";
import { colors, type Palette } from "@/theme/tokens.ts";

void SplashScreen.preventAutoHideAsync();
configureNotifications();

/** Dev : Expo Go garde son propre écran de chargement un instant après hideAsync ; on attend pour capturer l'animation. */
const DEMO_START_DELAY_MS = 1500;
async function hideNativeSplash(): Promise<void> {
  await SplashScreen.hideAsync();
  if (demoVar("splash")) await new Promise((r) => setTimeout(r, DEMO_START_DELAY_MS));
}

/**
 * Le splash natif (aplat nuit, sans image) reste affiché jusqu'à la première image du splash animé,
 * qui ne se joue qu'au démarrage à froid (ce composant racine n'est monté qu'une fois).
 */
export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [splash, setSplash] = useState<"shown" | "done">("shown");
  const outcome = useSplashOutcome();
  const pathname = usePathname();
  /** Garde-fou : une route qui n'a pas signalé son issue ne bloque jamais l'app sur le splash. */
  const forceSplashEnd = () => {
    if (__DEV__) console.warn(`splash : aucune issue signalée par la route « ${pathname} », fondu forcé`);
    settleSplash({ kind: "fade" });
  };
  useEffect(() => { void readSplashPalette().then(setPalette); }, []);
  // Journal de navigation (builds Release instrumentés) : URL de lancement, événements url, pile.
  const rootState = useRootNavigationState();
  useEffect(() => {
    void Linking.getInitialURL().then((url) => navLog("Linking.getInitialURL", url));
    const sub = Linking.addEventListener("url", (e) => navLog("Linking url event", e.url));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const stack = (rootState?.routes?.[0] as { state?: { routes?: { name: string; params?: { id?: string } }[] } } | undefined)?.state?.routes;
    navLog("pile", { pathname, routes: stack?.map((r) => `${r.name}${r.params?.id ? `:${r.params.id.slice(0, 8)}` : ""}`) });
  }, [rootState, pathname]);
  if (!fontsLoaded || !palette) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={splash === "shown" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
      {splash === "shown" ? (
        <Splash palette={palette} outcome={outcome} onFirstFrame={hideNativeSplash} onDone={() => setSplash("done")} onHoldTimeout={forceSplashEnd} />
      ) : null}
      {__DEV__ ? <FpsOverlay /> : null}
    </GestureHandlerRootView>
  );
}
