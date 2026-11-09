import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { demo as demoVar } from "@/lib/demo.ts";
import { configureNotifications } from "@/lib/notifications.ts";
import { readSplashPalette, settleSplash, useSplashOutcome } from "@/lib/splashStore.ts";
import { Splash } from "@/screens/Splash.tsx";
import { useAppFonts } from "@/theme/fonts.ts";
import { FpsOverlay } from "@/ui/FpsOverlay.tsx";
import { FoldProvider, useFold } from "@/ui/fold/FoldProvider.tsx";
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
  if (!fontsLoaded || !palette) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <FoldProvider>
        <StatusBar style={splash === "shown" ? "light" : "dark"} />
        <AppFrame>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
          {splash === "shown" ? (
            <Splash palette={palette} outcome={outcome} onFirstFrame={hideNativeSplash} onDone={() => setSplash("done")} onHoldTimeout={forceSplashEnd} />
          ) : null}
        </AppFrame>
        {__DEV__ ? <FpsOverlay /> : null}
      </FoldProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Page unique : l'app garde ses marges latérales hors des zones sûres (rail de barre d'état vertical de
 * l'iPhone Duo), exactement comme avant le SDK iOS 27.1. Sur un iPhone ordinaire en portrait, ces marges
 * valent 0 : rien ne change. En double page, chaque page gère elle-même ses zones sûres.
 */
function AppFrame({ children }: { children: ReactNode }) {
  const fold = useFold();
  const insets = useSafeAreaInsets();
  const sides = fold.kind === "single" ? { paddingLeft: insets.left, paddingRight: insets.right } : null;
  return <View style={[styles.root, sides]}>{children}</View>;
}

const styles = StyleSheet.create({
  /** Noir sous les marges latérales, comme l'écran autour d'une app qui évite le rail. */
  root: { flex: 1, backgroundColor: "#000" },
});
