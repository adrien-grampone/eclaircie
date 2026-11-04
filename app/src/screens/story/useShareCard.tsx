import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { exportCard, shareCardFile } from "@/lib/share.ts";
import { shareFileName, shareMessage } from "@/lib/shareCard.ts";
import type { DailyView } from "@/lib/stories.ts";
import { ShareCard } from "@/ui/ShareCard.tsx";
import { demo as demoVar } from "@/lib/demo.ts";

type Story = NonNullable<DailyView["pick"]["story"]>;

/**
 * Partage (spec §8, écran 5) : la carte est montée SOUS l'écran (cachée par l'illustration et la
 * feuille, donc rendue par iOS), capturée en PNG dès que son image est affichée, puis proposée dans
 * la feuille de partage iOS avec un texte d'accompagnement. `EXPO_PUBLIC_DEMO_SHARE=capture` journalise
 * le fichier au lieu de partager.
 */
export function useShareCard(view: DailyView, story: Story | null) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [phase, setPhase] = useState<"idle" | "rendering" | "capturing">("idle");
  const demo = demoVar("share") === "capture";

  const share = () => {
    if (story && phase === "idle") setPhase("rendering");
  };

  const onReady = () => {
    if (phase !== "rendering" || !story) return;
    setPhase("capturing");
    // Un instant pour que le dernier rendu soit à l'écran avant la capture.
    setTimeout(() => {
      exportCard(ref, shareFileName(story))
        .then(async (uri) => {
          if (demo) {
            console.log(`partage : fichier ${uri}`);
            return;
          }
          await shareCardFile(uri, shareMessage());
        })
        .catch((cause: unknown) => console.warn(`partage : ${cause instanceof Error ? cause.message : String(cause)}`))
        .finally(() => setPhase("idle"));
    }, 80);
  };

  const element = story && phase !== "idle"
    ? <View style={styles.hidden} pointerEvents="none"><ShareCard ref={ref} story={story} view={view} onReady={onReady} /></View>
    : null;
  return { share, element, busy: phase !== "idle" };
}

const styles = StyleSheet.create({
  hidden: { position: "absolute", top: 0, left: 0 },
});
