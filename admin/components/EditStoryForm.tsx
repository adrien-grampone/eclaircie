import { editStory } from "@/lib/actions.ts";
import type { StoryRow } from "@/lib/types.ts";

/** Édition du texte par l'humain, repliée sous « Éditer le texte ». */
export function EditStoryForm({ story }: { story: StoryRow }) {
  return (
    <details>
      <summary>Éditer le texte</summary>
      <form action={editStory} className="stack">
        <input type="hidden" name="id" value={story.id} />
        <label>Titre <input name="title_main" defaultValue={story.title_main} required /></label>
        <label>Chute (italique) <input name="title_accent" defaultValue={story.title_accent ?? ""} /></label>
        <label>Résumé <textarea name="summary" rows={4} defaultValue={story.summary} required /></label>
        <label>Scène (anglais) <textarea name="scene" rows={3} defaultValue={story.scene ?? ""} required /></label>
        <button className="btn" type="submit">Enregistrer</button>
      </form>
    </details>
  );
}
