import type { ViewStyle } from "react-native";
import type { FoldLayout } from "@/lib/fold.ts";

/**
 * Feuille modale en bas d'écran : sur une double page, elle se pose sur la page droite seulement
 * (rien sur la pliure) et laisse la place au rail de barre d'état ; sinon, pleine largeur comme avant.
 */
export function pageSheetStyle(fold: FoldLayout, insetRight: number, padding: number): ViewStyle | null {
  if (fold.kind !== "spread") return null;
  return { marginLeft: fold.right.x, width: fold.right.width, paddingRight: insetRight + padding };
}
