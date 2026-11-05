import { dateOfTimestamp } from "@pipeline/dates.ts";
import type { DailyView } from "./stories.ts";
import type { Profile, Theme } from "@/types.ts";

/** App Group et clé UserDefaults lus par la cible `targets/widget` (WidgetStore.swift). */
export const WIDGET_APP_GROUP = "group.app.eclaircie";
export const WIDGET_KEY = "eclaircie.widget";
export const WIDGET_KIND = "EclaircieWidget";
/** Côté max de l'illustration déposée pour le widget (mémoire des widgets ~30 Mo). */
export const WIDGET_IMAGE_MAX_SIDE = 600;

/** Miroir de `WidgetStory` (Swift). Jamais de colonne interne. */
export interface WidgetStory {
  id: string | null;
  themeId: string;
  themeLabel: string;
  titleMain: string;
  titleAccent: string | null;
  source: string | null;
  palette: Theme["palette"];
  imagePath: string | null;
  remoteImagePath: string | null;
}

/** Miroir de `WidgetPayload` (Swift). `anonKey` est la clé publique de l'app, jamais une clé service_role. */
export interface WidgetPayload {
  version: 1;
  supabaseUrl: string;
  anonKey: string;
  themes: string[];
  themeInfo: Record<string, { label: string; palette: Theme["palette"] }>;
  signupDate: string;
  story: WidgetStory | null;
  storyDate: string | null;
}

/**
 * Charge utile écrite dans l'App Group à chaque ouverture : la nouvelle du jour choisie par l'app
 * (même rotation que le widget), ou rien si aucune n'est validée (le widget affiche la promesse du lendemain).
 */
export function buildWidgetPayload(args: {
  supabaseUrl: string;
  anonKey: string;
  profile: Profile;
  themes: readonly Theme[];
  view: DailyView;
  imagePath: string | null;
}): WidgetPayload {
  const { profile, themes, view } = args;
  const chosen = [...new Set(profile.themes)].sort();
  const themeInfo: WidgetPayload["themeInfo"] = {};
  for (const theme of themes) if (chosen.includes(theme.id)) themeInfo[theme.id] = { label: theme.label, palette: theme.palette };
  const story = view.pick.story;
  return {
    version: 1,
    supabaseUrl: args.supabaseUrl,
    anonKey: args.anonKey,
    themes: chosen,
    themeInfo,
    signupDate: dateOfTimestamp(profile.created_at),
    story: story
      ? {
          id: story.id,
          themeId: story.theme_id,
          themeLabel: view.theme.label,
          titleMain: story.title_main,
          titleAccent: story.title_accent,
          source: story.source_name,
          palette: view.theme.palette,
          imagePath: args.imagePath,
          remoteImagePath: story.image_path,
        }
      : null,
    storyDate: story ? view.today : null,
  };
}
