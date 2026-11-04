import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { loadStory } from "@/lib/archiveStore.ts";
import type { DailyView } from "@/lib/stories.ts";
import { storyView } from "@/lib/storyView.ts";
import { useBoot } from "@/lib/useBoot.ts";
import { DailyStoryScreen } from "@/screens/DailyStory.tsx";
import { ErrorState, ListScreen, Loading } from "@/ui/ListScreen.tsx";

type State = { status: "loading" } | { status: "ready"; view: DailyView } | { status: "error"; message: string };

/** Une nouvelle ouverte depuis les Archives ou les Gardées : l'écran Nouvelle, avec retour. */
export default function StoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const boot = useBoot();
  const [state, setState] = useState<State>({ status: "loading" });
  const themes = boot.status === "ready" ? boot.boot.themes : null;
  useEffect(() => {
    if (!themes || !id) return;
    loadStory(id)
      .then(async (story) => {
        if (!story) throw new Error("Cette nouvelle n'est plus disponible.");
        return storyView(story, themes);
      })
      .then((view) => setState({ status: "ready", view }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, [themes, id]);
  if (boot.status === "error") return <ListScreen title="Nouvelle"><ErrorState message={boot.message} /></ListScreen>;
  if (state.status === "error") return <ListScreen title="Nouvelle"><ErrorState message={state.message} /></ListScreen>;
  if (boot.status !== "ready" || state.status !== "ready") return <ListScreen title="Nouvelle"><Loading /></ListScreen>;
  return <DailyStoryScreen view={state.view} userId={boot.boot.user.id} onBack={() => router.back()} />;
}
