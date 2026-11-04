import { loadAdminConfig, stockByTheme } from "@/lib/queries.ts";
import { Shell } from "@/components/Shell.tsx";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const config = await loadAdminConfig();
  const stock = await stockByTheme(config);
  return (
    <Shell title="Stock">
      <p className="meta">Jours programmés par thème à partir d'aujourd'hui ; en rouge sous {config.stock_alert_days} jours. Schedule tourne toutes les heures.</p>
      <table>
        <thead><tr><th>Thème</th><th>Jours</th><th>Premier trou</th><th>Sans image</th><th>Programmées</th></tr></thead>
        <tbody>
          {stock.map(({ theme, days, firstGap, withoutImage, scheduled }) => (
            <tr key={theme.id} className={days < config.stock_alert_days ? "low" : ""}>
              <td><span className="chip" style={{ background: theme.palette.accent }}>{theme.label}</span></td>
              <td><strong>{days}</strong></td>
              <td>{firstGap}</td>
              <td>{withoutImage > 0 ? <span className="warn">{withoutImage}</span> : 0}</td>
              <td className="meta">{scheduled.map((s) => <div key={s.id}>{s.publish_date} · {s.title_main}{s.image_path ? "" : " · sans image"}{s.approved_at ? "" : " · texte non validé"}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
