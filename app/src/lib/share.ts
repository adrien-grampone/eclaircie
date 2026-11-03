import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

/** Capture PNG de la carte (échelle de l'appareil : ×3 sur les iPhone récents), fichier temporaire. */
export type CaptureTarget = Parameters<typeof captureRef>[0];

export function captureCard(ref: CaptureTarget): Promise<string> {
  return captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
}

/** Feuille de partage iOS ; false si le partage n'est pas disponible. */
export async function shareFile(uri: string, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
  return true;
}
