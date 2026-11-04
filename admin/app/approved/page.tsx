import { APPROVED_COPY } from "@/lib/approved.ts";
import { approvedStories, loadThemes } from "@/lib/queries.ts";
import { Shell } from "@/components/Shell.tsx";
import { StoryCard } from "@/components/StoryCard.tsx";

export const dynamic = "force-dynamic";

export default async function ApprovedPage() {
  const [stories, themes] = await Promise.all([approvedStories(), loadThemes()]);
  const byId = new Map(themes.map((t) => [t.id, t]));
  return (
    <Shell title="Validées">
      <p className="counter"><strong>{stories.length}</strong> texte{stories.length > 1 ? "s" : ""} validé{stories.length > 1 ? "s" : ""} <span className="meta">· {APPROVED_COPY.intro}</span></p>
      {stories.length === 0 ? <p className="ok">Aucun texte validé.</p> : null}
      {stories.map((story) => <StoryCard key={story.id} story={story} theme={byId.get(story.theme_id)} approved />)}
    </Shell>
  );
}
