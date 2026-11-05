// Collecteur du journal de navigation d'un build instrumenté (EXPO_PUBLIC_NAV_LOG_URL).
// Usage : node scripts/navlog-server.mjs [fichier]   → écoute sur 0.0.0.0:8099, affiche et enregistre chaque ligne.
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const out = process.argv[2] ?? `navlog-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jsonl`;
const port = 8099;
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    if (body) {
      appendFileSync(out, `${body}\n`);
      try { const { ms, event, data } = JSON.parse(body); console.log(`${String(ms).padStart(7)} ms  ${event}  ${data === undefined ? "" : JSON.stringify(data)}`); } catch { console.log(body); }
    }
    res.writeHead(204); res.end();
  });
}).listen(port, "0.0.0.0", () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`collecteur prêt sur le port ${port} ; adresses : ${ips.join(", ")} ; fichier : ${out}`);
});
