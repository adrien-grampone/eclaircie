import { removeFallback, uploadFallback } from "@/lib/actions.ts";
import { illustrationUrl } from "@/lib/env.ts";
import { fallbackSets, imagesToDo, loadAdminConfig } from "@/lib/queries.ts";
import { ImageDrop } from "@/components/ImageDrop.tsx";
import { Shell } from "@/components/Shell.tsx";
import { StoryCard } from "@/components/StoryCard.tsx";

export const dynamic = "force-dynamic";

export default async function ImagesPage() {
  const config = await loadAdminConfig();
  const [{ tasks, nextDue }, fallbacks] = await Promise.all([imagesToDo(config), fallbackSets()]);
  return (
    <Shell title="Images à faire">
      <p className="counter">
        <strong>{tasks.length}</strong> image{tasks.length > 1 ? "s" : ""} à faire{nextDue ? <>, prochaine échéance : <strong>{nextDue}</strong></> : null}
        <span className="meta"> · stories programmées sur {config.schedule_horizon_days} jours sans image, par date de publication</span>
      </p>
      {tasks.length === 0 ? <p className="ok">Tout est illustré.</p> : null}
      {tasks.map(({ story, theme, prompt }) => <StoryCard key={story.id} story={story} theme={theme} prompt={prompt} />)}

      <h2>Illustrations de secours</h2>
      <p className="meta">Affichées par l'app quand une nouvelle est publiée sans image. Plusieurs par thème, dans fallback/&lt;thème&gt;/ du bucket.</p>
      <div className="fallbacks">
        {fallbacks.map(({ theme, files }) => (
          <section key={theme.id} className="fallback">
            <h3><span className="chip" style={{ background: theme.palette.accent }}>{theme.label}</span> {files.length} image{files.length > 1 ? "s" : ""}</h3>
            <div className="thumbs">
              {files.map((path) => (
                <form key={path} action={removeFallback} className="thumb">
                  <img src={illustrationUrl(path)} alt="" />
                  <input type="hidden" name="path" value={path} />
                  <button className="btn small danger" type="submit">Supprimer</button>
                </form>
              ))}
            </div>
            <ImageDrop target={{ kind: "fallback", themeId: theme.id }} upload={uploadFallback} label="Ajouter une image de secours" />
          </section>
        ))}
      </div>
    </Shell>
  );
}
