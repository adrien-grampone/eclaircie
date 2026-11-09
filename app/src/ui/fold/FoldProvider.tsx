import { ArrangementView, Host, Rectangle } from "@expo/ui/swift-ui";
import { arrangementViewStyle, frame, onGeometryChange, opacity } from "@expo/ui/swift-ui/modifiers";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SINGLE, foldLayout, type FoldLayout, type Frame } from "@/lib/fold.ts";

const FoldContext = createContext<FoldLayout>(SINGLE);

/** Double page (iPhone Duo déplié) ou page unique (tout le reste, rendu habituel). */
export function useFold(): FoldLayout {
  return useContext(FoldContext);
}

/**
 * Taille du cadre de l'app : la fenêtre, moins les marges latérales en page unique (rail de barre d'état
 * de l'iPhone Duo, voir AppFrame). À utiliser à la place de useWindowDimensions pour toute géométrie.
 */
export function useAppSize(): { width: number; height: number } {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fold = useFold();
  return { width: fold.kind === "single" ? window.width - insets.left - insets.right : window.width, height: window.height };
}

const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });

/**
 * Sonde invisible : un `ArrangementView` (style « split ») plein écran, dont les deux panneaux vides
 * rapportent leur cadre. Le système les place de part et d'autre de la pliure quand l'appareil est
 * déplié et les empile ou les replie sinon ; `foldLayout` en déduit la mise en page. Le contenu de l'app
 * reste en React Native (animations Reanimated, gestes, défilement), seule la découpe vient de SwiftUI.
 */
export function FoldProvider({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const [primary, setPrimary] = useState<Frame | null>(null);
  const [secondary, setSecondary] = useState<Frame | null>(null);
  const layout = useMemo(() => foldLayout(window, primary, secondary), [window, primary, secondary]);
  return (
    <FoldContext.Provider value={layout}>
      {Platform.OS === "ios" ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
          {/* Toute la fenêtre, zones sûres comprises : sinon la sonde coupe en deux l'écran privé du rail, pas l'écran. */}
          <Host style={StyleSheet.absoluteFill} pointerEvents="none" ignoreSafeArea="all">
            <ArrangementView modifiers={[arrangementViewStyle("split", { axes: "horizontal" }), fill, opacity(0)]}>
              <ArrangementView.Primary>
                <Rectangle modifiers={[fill, onGeometryChange(setPrimary)]} />
              </ArrangementView.Primary>
              <ArrangementView.Secondary>
                <Rectangle modifiers={[fill, onGeometryChange(setSecondary)]} />
              </ArrangementView.Secondary>
            </ArrangementView>
          </Host>
        </View>
      ) : null}
      {children}
    </FoldContext.Provider>
  );
}
