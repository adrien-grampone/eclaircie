import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { loadStory } from "@/lib/archiveStore.ts";
import { backHref, isStoryId, resolveStoryOpen } from "@/lib/deepLink.ts";
import { settleSplash } from "@/lib/splashStore.ts";
import type { DailyView } from "@/lib/stories.ts";
import { storyView } from "@/lib/storyView.ts";
import { useBoot } from "@/lib/useBoot.ts";
import { DailyStoryScreen } from "@/screens/DailyStory.tsx";
import { ErrorState, ListScreen, Loading } from "@/ui/ListScreen.tsx";

type State = { status: "loading" } | { status: "ready"; view: DailyView } | { status: "error"; message: string };

/**
 * Une nouvelle ouverte directement : depuis les Archives ou les Gardées (retour vers la liste), ou par
 * lien profond `eclaircie://story/<id>` (widget, écran verrouillé, notification). Au démarrage à froid, elle
 * signale aussitôt son issue au splash (« Nouvelle directe » : simple fondu). Id inconnu ou nouvelle plus
 * disponible : l'Arrivée du jour, jamais un écran vide.
 */
export default function StoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const boot = useBoot();
  const [state, setState] = useState<State>({ status: "loading" });
  const themes = boot.status === "ready" ? boot.boot.themes : null;
  useEffect(() => { settleSplash({ kind: "fade" }); }, []);
  useEffect(() => {
    if (!isStoryId(id)) { router.replace("/"); return; }
    if (!themes) return;
    loadStory(id)
      .then((story) => ({ story }), (cause: unknown) => ({ error: cause instanceof Error ? cause.message : String(cause) }))
      .then(async (result) => {
        const open = resolveStoryOpen(id, result);
        if (open.kind === "redirect") { router.replace(open.href); return; }
        if (open.kind === "error") { setState({ status: "error", message: open.message }); return; }
        if ("story" in result && result.story) setState({ status: "ready", view: await storyView(result.story, themes) });
      })
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
    // router est stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes, id]);
  const onBack = () => { backHref(router.canGoBack()) === "back" ? router.back() : router.replace("/"); };
  if (boot.status === "error") return <ListScreen title="Nouvelle"><ErrorState message={boot.message} /></ListScreen>;
  if (state.status === "error") return <ListScreen title="Nouvelle"><ErrorState message={state.message} /></ListScreen>;
  if (boot.status !== "ready" || state.status !== "ready") return <ListScreen title="Nouvelle"><Loading /></ListScreen>;
  return <DailyStoryScreen view={state.view} userId={boot.boot.user.id} onBack={onBack} />;
}
