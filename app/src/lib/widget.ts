import { ExtensionStorage } from "@bacons/apple-targets";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { WidgetImage } from "../../modules/widget-image/index.ts";
import type { DailyView } from "./stories.ts";
import { WIDGET_APP_GROUP, WIDGET_IMAGE_MAX_SIDE, WIDGET_KEY, WIDGET_KIND, buildWidgetPayload } from "./widgetPayload.ts";
import type { Profile, Theme } from "@/types.ts";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * À chaque ouverture : dépose dans l'App Group la nouvelle du jour, son illustration réduite et le profil
 * (thèmes, date d'inscription), puis demande à iOS de redessiner le widget. Silencieux en cas d'échec
 * (Expo Go sans module natif, Android, réseau) : le widget garde sa dernière donnée.
 */
export async function syncWidget(profile: Profile, themes: readonly Theme[], view: DailyView): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const imagePath = await storeIllustration(view);
    const payload = buildWidgetPayload({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, profile, themes, view, imagePath });
    new ExtensionStorage(WIDGET_APP_GROUP).set(WIDGET_KEY, JSON.stringify(payload));
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch {
    // Pas de widget disponible (Expo Go) ou dépôt impossible : rien à faire.
  }
}

/** Télécharge l'illustration affichée (expo-image l'a déjà en cache réseau) et la réduit dans le conteneur partagé. */
async function storeIllustration(view: DailyView): Promise<string | null> {
  if (!view.image || !WidgetImage) return null;
  const temp = new Directory(Paths.cache, "widget");
  if (!temp.exists) temp.create();
  const file = await File.downloadFileAsync(view.image.url, new File(temp, "illustration.webp"), { idempotent: true });
  try {
    return await WidgetImage.store(file.uri, WIDGET_APP_GROUP, WIDGET_IMAGE_MAX_SIDE);
  } finally {
    file.delete();
  }
}
