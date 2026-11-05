/**
 * Journal de navigation hors Metro (builds Release sur simulateur) : chaque événement est envoyé en HTTP à
 * l'URL `EXPO_PUBLIC_NAV_LOG_URL` fixée au moment du build. Absente (builds EAS, Expo Go) : aucun effet.
 */
const TARGET = process.env.EXPO_PUBLIC_NAV_LOG_URL;
const startedAt = Date.now();

export function navLog(event: string, data?: unknown): void {
  if (!TARGET) return;
  fetch(TARGET, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ms: Date.now() - startedAt, event, data }) })
    .catch(() => undefined);
}
