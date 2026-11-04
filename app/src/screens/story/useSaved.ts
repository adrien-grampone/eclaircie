import { useEffect, useState } from "react";
import { toggleSaved } from "@/lib/archive.ts";
import { hapticTap } from "@/lib/haptics.ts";
import { loadSavedIds, setSaved } from "@/lib/savedStore.ts";

/** Signet d'une story : état chargé une fois, bascule optimiste avec haptique, retour arrière si l'écriture échoue. */
export function useSaved(userId: string, storyId: string | null) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    loadSavedIds(userId).then(setIds).catch((cause: unknown) => console.warn(`gardées : ${cause instanceof Error ? cause.message : String(cause)}`));
  }, [userId]);
  const saved = storyId !== null && ids.has(storyId);
  const toggle = () => {
    if (!storyId) return;
    hapticTap();
    const next = toggleSaved(ids, storyId);
    setIds(next);
    setSaved(userId, storyId, next.has(storyId)).catch(() => setIds(ids));
  };
  return { saved, toggle };
}
