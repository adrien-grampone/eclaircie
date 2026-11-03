import { toIsoDate } from "@pipeline/dates.ts";
import { fallbackPrefix } from "@pipeline/illustration.ts";
import { selectDailyStory, type DailyPick } from "./daily.ts";
import { storyImageUrl } from "./illustration.ts";
import { supabase } from "./supabase.ts";
import { STORY_COLUMNS, type Profile, type Story, type Theme } from "@/types.ts";

export interface DailyView {
  pick: DailyPick;
  theme: Theme;
  image: { url: string; fallback: boolean } | null;
  today: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

/** Nouvelle du jour d'un profil : stories visibles, choix pur, image. */
export async function loadDailyView(profile: Profile, themes: readonly Theme[]): Promise<DailyView> {
  const today = toIsoDate(new Date());
  const { data, error } = await supabase.from("stories").select(STORY_COLUMNS)
    .in("theme_id", profile.themes).lte("publish_date", today)
    .order("publish_date", { ascending: false }).limit(60);
  if (error) throw new Error(`stories : ${error.message}`);
  const pick = selectDailyStory(profile.themes, profile.created_at, today, data as Story[]);
  if (!pick) throw new Error("aucun thème dans le profil");
  const theme = themes.find((t) => t.id === pick.themeId);
  if (!theme) throw new Error(`thème inconnu : ${pick.themeId}`);
  let image: DailyView["image"] = null;
  if (pick.story) {
    const files = pick.story.image_path ? [] : await listFallbackFiles(pick.themeId);
    image = storyImageUrl(SUPABASE_URL, pick.story, files);
  }
  return { pick, theme, image, today };
}

async function listFallbackFiles(themeId: string): Promise<string[]> {
  const folder = fallbackPrefix(themeId).slice(0, -1);
  const { data, error } = await supabase.storage.from("illustrations").list(folder, { limit: 100 });
  if (error) return [];
  return (data ?? []).map((f) => `${folder}/${f.name}`);
}
