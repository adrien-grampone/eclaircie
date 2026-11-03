import { approveStory, editStory, rejectStory, retractStory, uploadIllustration } from "@/lib/actions.ts";
import { illustrationUrl } from "@/lib/env.ts";
import type { StoryRow, ThemeRow } from "@/lib/types.ts";
import { CopyButton } from "./CopyButton.tsx";
import { ImageDrop } from "./ImageDrop.tsx";

interface Props {
  story: StoryRow;
  theme: ThemeRow | undefined;
  prompt?: string;
  /** Afficher le formulaire d'édition et les actions de validation. */
  review?: boolean;
}

export function StoryCard({ story, theme, prompt, review = false }: Props) {
  const statusLabel = story.status === "scheduled" && story.image_path === null ? "programmée, en attente d'image" : story.status;
  return (
    <article className="card" id={story.id}>
      <header className="card-head">
        <span className="chip" style={{ background: theme?.palette.accent ?? "#999" }}>{theme?.label ?? story.theme_id}</span>
        <span className="meta">{story.publish_date ? `publication le ${story.publish_date}` : "non programmée"} · {statusLabel} · score {story.score.toFixed(2)}{story.evergreen ? " · intemporelle" : ""}{story.approved_at ? " · texte validé" : ""}</span>
      </header>
      <div className="card-body">
        <div className="card-image">
          {story.image_path
            ? <img src={illustrationUrl(story.image_path)} alt="" />
            : <div className="placeholder">pas d'image</div>}
          <ImageDrop target={{ kind: "story", storyId: story.id }} upload={uploadIllustration}
            label={story.image_path ? "Remplacer l'image" : "Déposer l'image (3:4, WebP automatique)"} />
        </div>
        <div className="card-text">
          <h2>{story.title_main} <em>{story.title_accent}</em></h2>
          <p>{story.summary}</p>
          <p className="meta">Source : <a href={story.source_url} target="_blank" rel="noreferrer">{story.source_name}</a>{story.source_date ? ` · ${story.source_date}` : ""}</p>
          {prompt ? (
            <details open>
              <summary>Prompt complet</summary>
              <pre className="prompt">{prompt}</pre>
              <CopyButton text={prompt} />
            </details>
          ) : null}
          {review ? (
            <>
              <details>
                <summary>Claims et preuves ({story.claims.length})</summary>
                <ul className="claims">
                  {story.claims.map((c, i) => <li key={i}><strong>{c.claim}</strong><br /><span className="meta">« {c.evidence} »</span></li>)}
                </ul>
              </details>
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
              <div className="actions">
                <form action={approveStory}><input type="hidden" name="id" value={story.id} /><button className="btn primary" type="submit">Valider le texte</button></form>
                <form action={rejectStory} className="inline">
                  <input type="hidden" name="id" value={story.id} />
                  <input name="reason" placeholder="raison du rejet" required />
                  <button className="btn danger" type="submit">Rejeter</button>
                </form>
                {story.status === "scheduled" ? (
                  <form action={retractStory} className="inline">
                    <input type="hidden" name="id" value={story.id} />
                    <input name="reason" placeholder="raison du retrait (optionnel)" />
                    <button className="btn danger" type="submit">Retirer</button>
                  </form>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
