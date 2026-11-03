import { loadThemes, reviewQueue } from "@/lib/queries.ts";
import { Shell } from "@/components/Shell.tsx";
import { StoryCard } from "@/components/StoryCard.tsx";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [stories, themes] = await Promise.all([reviewQueue(), loadThemes()]);
  const byId = new Map(themes.map((t) => [t.id, t]));
  return (
    <Shell title="À valider">
      <p className="counter"><strong>{stories.length}</strong> texte{stories.length > 1 ? "s" : ""} à relire <span className="meta">· stories vérifiées ou programmées, non encore validées ; les programmées d'abord</span></p>
      {stories.length === 0 ? <p className="ok">Rien à relire.</p> : null}
      {stories.map((story) => <StoryCard key={story.id} story={story} theme={byId.get(story.theme_id)} review />)}
    </Shell>
  );
}
