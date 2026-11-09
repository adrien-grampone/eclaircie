// Construit le rapport avant/après du test à blanc à partir de reecriture.json et tri.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const HERE = new URL(".", import.meta.url).pathname;
const out: string[] = ["# Test à blanc contenu (rien d'écrit en base)", ""];
if (existsSync(`${HERE}reecriture.json`)) {
  const r = JSON.parse(readFileSync(`${HERE}reecriture.json`, "utf8")) as any[];
  out.push("## Réécriture des 20 nouvelles (nouvelle consigne, Haiku 5.5) et relecture par le vérificateur actuel", "");
  const n = (k: string) => r.filter((x) => x.issue === k).length;
  out.push(`Issue : ${n("vérifiée")} vérifiées, ${n("rejetée par le vérificateur")} rejetées par le vérificateur, ${n("refusée par le rédacteur") + n("refusée à la révision")} refusées par le rédacteur, ${n("erreur")} en erreur.`, "");
  for (const [i, x] of r.entries()) {
    out.push(`### ${i + 1}. ${x.validee ? "Validée" : "Non validée"} · ${x.theme} · ${x.source} · **${x.issue}**${x.passes === 2 ? " après révision" : ""}`, "");
    out.push(`**Avant** : ${x.avant.titre}`, "", `> ${x.avant.resume}`, "");
    if (x.apres) out.push(`**Après** : ${x.apres.title_main} *${x.apres.title_accent}* (${x.apres.mots_titre} mots, résumé ${x.apres.car_resume} car.${x.apres.depassements.length ? `, dépasse : ${x.apres.depassements.join(", ")}` : ""})`, "", `> ${x.apres.resume}`, "");
    if (x.detail) out.push(`Motif : ${x.detail}`, "");
    if (x.problemes?.length) { out.push("Relevé par le vérificateur (1re passe) :"); for (const p of x.problemes) out.push(`- ${p}`); out.push(""); }
  }
}
if (existsSync(`${HERE}tri.json`)) {
  const t = (JSON.parse(readFileSync(`${HERE}tri.json`, "utf8")) as any[]).filter((x) => !x.erreur);
  const before = t.filter((x) => x.garde_avant), after = t.filter((x) => x.garde_apres);
  out.push("## Re-tri des articles des 2 derniers jours avec le score d'impact", "");
  out.push(`${t.length} articles. Retenus par le tri actuel : ${before.length}. Retenus avec le score d'impact : ${after.length}.`, "");
  const row = (x: any) => `| ${x.score_actuel.toFixed(2)} | ${x.impact.toFixed(2)} | ${x.final.toFixed(2)} | ${x.theme ?? ""} | ${x.source} | ${String(x.titre).replace(/\|/g, "/").slice(0, 110)} |`;
  out.push("### Les 14 premiers du tri actuel (2 jours × 7 thèmes)", "", "| Actuel | Impact | Final | Thème | Source | Titre de l'article |", "|---|---|---|---|---|---|");
  [...before].sort((a, b) => b.score_actuel - a.score_actuel).slice(0, 14).forEach((x) => out.push(row(x)));
  out.push("", "### Les 14 premiers avec le score d'impact", "", "| Actuel | Impact | Final | Thème | Source | Titre de l'article |", "|---|---|---|---|---|---|");
  [...after].sort((a, b) => b.final - a.final).slice(0, 14).forEach((x) => out.push(row(x)));
  out.push("", "### Écartés par le score d'impact (retenus aujourd'hui)", "", "| Actuel | Impact | Final | Thème | Source | Titre de l'article |", "|---|---|---|---|---|---|");
  before.filter((x) => !x.garde_apres).sort((a, b) => b.score_actuel - a.score_actuel).forEach((x) => out.push(row(x)));
}
writeFileSync(`${HERE}rapport.md`, out.join("\n"));
console.log("rapport.md écrit");
