import { toIsoDate } from "@pipeline/dates.ts";
import { storyImageUrl } from "./illustration.ts";
import { listFallbackFiles, type DailyView } from "./stories.ts";
import type { Story, Theme } from "@/types.ts";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

/** Vue « Nouvelle » d'une story précise (Archives, Gardées), avec son image comme pour la Nouvelle du jour. */
export async function storyView(story: Story, themes: readonly Theme[]): Promise<DailyView> {
  const theme = themes.find((t) => t.id === story.theme_id);
  if (!theme) throw new Error(`thème inconnu : ${story.theme_id}`);
  const files = story.image_path ? [] : await listFallbackFiles(story.theme_id);
  return { pick: { themeId: story.theme_id, story }, theme, image: storyImageUrl(SUPABASE_URL, story, files), today: toIsoDate(new Date()) };
}
