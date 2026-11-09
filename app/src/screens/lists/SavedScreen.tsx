import { useEffect, useState } from "react";
import { SAVED_COPY } from "@/lib/archive.ts";
import { loadSavedStories } from "@/lib/savedStore.ts";
import { useBoot } from "@/lib/useBoot.ts";
import type { Story } from "@/types.ts";
import { EmptyState, ErrorState, ListScreen, Loading } from "@/ui/ListScreen.tsx";
import { StoryList } from "./StoryList.tsx";

type State = { status: "loading" } | { status: "ready"; stories: Story[] } | { status: "error"; message: string };

/** Écran 7 : les nouvelles gardées, même présentation que les Archives. */
export function SavedScreen() {
  const boot = useBoot();
  const [state, setState] = useState<State>({ status: "loading" });
  const userId = boot.status === "ready" ? boot.boot.user.id : null;
  useEffect(() => {
    if (!userId) return;
    loadSavedStories(userId)
      .then((stories) => setState({ status: "ready", stories }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, [userId]);

  let body;
  if (boot.status === "error") body = <ErrorState message={boot.message} />;
  else if (state.status === "error") body = <ErrorState message={state.message} />;
  else if (boot.status !== "ready" || state.status !== "ready") body = <Loading />;
  else if (state.stories.length === 0) body = <EmptyState {...SAVED_COPY.empty} />;
  else body = <StoryList themes={boot.boot.themes} sections={[{ title: SAVED_COPY.title.toUpperCase(), stories: state.stories, paginated: true }]} />;
  return <ListScreen title={SAVED_COPY.title} grid={state.status === "ready" && state.stories.length > 0}>{body}</ListScreen>;
}
