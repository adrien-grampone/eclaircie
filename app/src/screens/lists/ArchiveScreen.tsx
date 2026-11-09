import { useEffect, useState } from "react";
import { ARCHIVE_COPY } from "@/lib/archive.ts";
import { loadArchive, type ArchiveData } from "@/lib/archiveStore.ts";
import { useBoot } from "@/lib/useBoot.ts";
import { EmptyState, ErrorState, ListScreen, Loading } from "@/ui/ListScreen.tsx";
import { StoryList } from "./StoryList.tsx";

type State = { status: "loading" } | { status: "ready"; data: ArchiveData } | { status: "error"; message: string };

/** Écran 6 : « Aussi aujourd'hui » puis les jours passés, sur les thèmes de l'utilisateur. */
export function ArchiveScreen() {
  const boot = useBoot();
  const [state, setState] = useState<State>({ status: "loading" });
  const themes = boot.status === "ready" ? boot.boot.profile?.themes ?? [] : null;
  useEffect(() => {
    if (!themes) return;
    loadArchive(themes)
      .then((data) => setState({ status: "ready", data }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
    // Les thèmes du profil ne changent pas pendant la vie de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes?.join(",")]);

  let body;
  if (boot.status === "error") body = <ErrorState message={boot.message} />;
  else if (state.status === "error") body = <ErrorState message={state.message} />;
  else if (boot.status !== "ready" || state.status !== "ready") body = <Loading />;
  else if (state.data.alsoToday.length === 0 && state.data.past.length === 0) body = <EmptyState {...ARCHIVE_COPY.empty} />;
  else {
    body = (
      <StoryList
        themes={boot.boot.themes}
        sections={[{ title: ARCHIVE_COPY.alsoToday, stories: state.data.alsoToday }, { title: ARCHIVE_COPY.past, stories: state.data.past, paginated: true }]} />
    );
  }
  const grid = state.status === "ready" && (state.data.alsoToday.length > 0 || state.data.past.length > 0);
  return <ListScreen title={ARCHIVE_COPY.title} grid={grid}>{body}</ListScreen>;
}
