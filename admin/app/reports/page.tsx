import { retractStory } from "@/lib/actions.ts";
import { recentReports } from "@/lib/queries.ts";
import { Shell } from "@/components/Shell.tsx";

/** Libellés des raisons rapides (mêmes identifiants que l'app, colonne error_reports.reason). */
const REASONS: Record<string, string> = { inaccurate: "Fait inexact", source_missing: "Source introuvable", not_good_news: "Pas une bonne nouvelle" };

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await recentReports();
  return (
    <Shell title="Signalements">
      <p className="meta">Les 50 derniers signalements d'erreur envoyés depuis l'app. « Retirer » passe la nouvelle en retracted : elle disparaît de l'app.</p>
      {reports.length === 0 ? <p className="ok">Aucun signalement.</p> : null}
      <table>
        <thead><tr><th>Date</th><th>Nouvelle</th><th>Raison</th><th>Message</th><th></th></tr></thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td className="meta">{r.created_at.slice(0, 16).replace("T", " ")}</td>
              <td>{r.stories ? <>{r.stories.title_main} <em>{r.stories.title_accent}</em><div className="meta">{r.stories.theme_id} · {r.stories.status} · {r.stories.publish_date ?? "—"}</div></> : <span className="meta">story inconnue</span>}</td>
              <td>{r.reason ? REASONS[r.reason] ?? r.reason : <span className="meta">—</span>}</td>
              <td>{r.message ?? <span className="meta">(sans message)</span>}</td>
              <td>
                {r.stories && r.stories.status !== "retracted" ? (
                  <form action={retractStory} className="inline">
                    <input type="hidden" name="id" value={r.stories.id} />
                    <input name="reason" placeholder="raison" />
                    <button className="btn danger small" type="submit">Retirer la nouvelle</button>
                  </form>
                ) : <span className="meta">{r.stories ? "retirée" : ""}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
