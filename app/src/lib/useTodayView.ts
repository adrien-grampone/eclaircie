import { useEffect, useState } from "react";
import { loadDailyView, type DailyView } from "./stories.ts";
import { bootOnce } from "./useBoot.ts";

let pending: Promise<DailyView | null> | null = null;

/** Vue du jour (thème, illustration), chargée une fois par session ; null sans profil ou en cas d'erreur. */
function todayView(): Promise<DailyView | null> {
  pending ??= bootOnce()
    .then(({ profile, themes }) => (profile ? loadDailyView(profile, themes) : null))
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

/** Illustration du thème du jour pour la page gauche des écrans secondaires en double page. */
export function useTodayView(enabled: boolean): DailyView | null {
  const [view, setView] = useState<DailyView | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void todayView().then((v) => { if (alive) setView(v); });
    return () => { alive = false; };
  }, [enabled]);
  return view;
}
