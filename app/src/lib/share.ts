import { File, Paths } from "expo-file-system";
import { Share } from "react-native";
import { captureRef } from "react-native-view-shot";

export type CaptureTarget = Parameters<typeof captureRef>[0];

/**
 * Capture PNG de la carte (échelle de l'appareil : ×3 sur les iPhone récents), copiée dans le cache
 * sous un nom lisible (« eclaircie-3-novembre.png ») : c'est ce nom que montre la feuille de partage.
 */
export async function exportCard(ref: CaptureTarget, fileName: string): Promise<string> {
  const temporary = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
  const destination = new File(Paths.cache, fileName);
  await new File(temporary).copy(destination, { overwrite: true });
  return destination.uri;
}

/** Feuille de partage iOS (Share de React Native) : le fichier ET un texte d'accompagnement. */
export async function shareCardFile(uri: string, message: string): Promise<void> {
  await Share.share({ url: uri, message });
}
