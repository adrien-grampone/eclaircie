import { DMSans_400Regular, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { Fraunces_400Regular_Italic, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { useFonts } from "expo-font";

/** Charge Fraunces (titres, accent italique) et DM Sans (texte). Les noms correspondent à tokens.fonts. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({ Fraunces_600SemiBold, Fraunces_400Regular_Italic, DMSans_400Regular, DMSans_600SemiBold });
  return loaded;
}
