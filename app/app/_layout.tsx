import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { demo as demoVar } from "@/lib/demo.ts";
import { configureNotifications } from "@/lib/notifications.ts";
import { readSplashPalette, useSplashOutcome } from "@/lib/splashStore.ts";
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
  useEffect(() => { void readSplashPalette().then(setPalette); }, []);
  if (!fontsLoaded || !palette) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={splash === "shown" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
      {splash === "shown" ? (
        <Splash palette={palette} outcome={outcome} onFirstFrame={hideNativeSplash} onDone={() => setSplash("done")} />
      ) : null}
      {__DEV__ ? <FpsOverlay /> : null}
    </GestureHandlerRootView>
  );
}
