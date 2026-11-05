import { INITIAL_LAUNCH_GATE, gateSystemPath, type LaunchGate } from "@/lib/deepLink.ts";
import { navLog } from "@/lib/navLog.ts";

let gate: LaunchGate = INITIAL_LAUNCH_GATE;
const startedAt = Date.now();

/**
 * Porte d'entrée de toutes les URL système (expo-router). L'URL de lancement (widget, écran verrouillé)
 * n'est suivie qu'une seule fois : relue plus tard par iOS, elle mène à l'Arrivée ; rejouée en événement
 * url juste après le lancement, elle est ignorée. Aucun écran ne relit l'URL initiale.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  const result = gateSystemPath(gate, { path, initial, atMs: Date.now() - startedAt });
  gate = result.gate;
  navLog("native-intent", { path, initial, suivi: result.path });
  return result.path;
}
