import { resolveAlert } from "@/lib/actions.ts";
import { health } from "@/lib/queries.ts";
import { Shell } from "@/components/Shell.tsx";

export const dynamic = "force-dynamic";

const ago = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(minutes / 60)} h`;
};

export default async function HealthPage() {
  const h = await health();
  return (
    <Shell title="Santé du pipeline">
      <h2>Alertes ouvertes ({h.openAlerts.length})</h2>
      {h.openAlerts.length === 0 ? <p className="ok">Aucune alerte ouverte.</p> : null}
      <ul className="alerts">
        {h.openAlerts.map((a) => (
          <li key={a.id}>
            <strong>{a.kind}</strong> · {a.message} <span className="meta">({ago(a.created_at)})</span>
            <form action={resolveAlert} className="inline"><input type="hidden" name="fingerprint" value={a.fingerprint} /><button className="btn small" type="submit">Résoudre</button></form>
          </li>
        ))}
      </ul>
      <h2>Étapes sur 24 h</h2>
      <table>
        <thead><tr><th>Étape</th><th>Dernier run</th><th>Runs</th><th>Traités</th><th>Erreurs</th><th>Dernière erreur</th></tr></thead>
        <tbody>
          {h.steps.map((s) => (
            <tr key={s.step} className={s.errors24h > 0 ? "low" : ""}>
              <td>{s.step}</td><td>{ago(s.lastRun)}</td><td>{s.runs24h}</td><td>{s.processed24h}</td><td>{s.errors24h}</td><td className="meta">{s.lastError ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Articles par statut</h2>
      <p>{h.articlesByStatus.map((a) => <span key={a.status} className="pill">{a.status} : {a.count}</span>)}</p>
      <h2>Alertes résolues récemment</h2>
      <ul className="meta">{h.recentResolved.map((a) => <li key={a.id}>{a.kind} · {a.message} · résolue {a.resolved_at ? ago(a.resolved_at) : ""}</li>)}</ul>
    </Shell>
  );
}
