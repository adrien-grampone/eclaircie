import { useEffect, useState } from "react";
import { bootstrap, type Bootstrap } from "./bootstrap.ts";

let pending: Promise<Bootstrap> | null = null;

/** Démarrage partagé entre les écrans (session, thèmes, profil), chargé une fois par session d'app. */
export function bootOnce(): Promise<Bootstrap> {
  pending ??= bootstrap().catch((cause: unknown) => {
    pending = null;
    throw cause;
  });
  return pending;
}

/** Après l'onboarding ou un changement de profil : forcer un rechargement au prochain écran. */
export function resetBoot(): void {
  pending = null;
}

export type BootState = { status: "loading" } | { status: "ready"; boot: Bootstrap } | { status: "error"; message: string };

export function useBoot(): BootState {
  const [state, setState] = useState<BootState>({ status: "loading" });
  useEffect(() => {
    bootOnce()
      .then((boot) => setState({ status: "ready", boot }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) }));
  }, []);
  return state;
}
