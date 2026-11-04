import { supabase } from "./supabase.ts";
import { STORY_COLUMNS, type Story } from "@/types.ts";

/** Nouvelles gardées (saved_stories, RLS : les siennes seulement). */

export async function loadSavedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("saved_stories").select("story_id").eq("user_id", userId);
  if (error) throw new Error(`gardées : ${error.message}`);
  return new Set((data ?? []).map((r) => (r as { story_id: string }).story_id));
}

/** Garde ou retire une story ; renvoie l'état final. */
export async function setSaved(userId: string, storyId: string, saved: boolean): Promise<boolean> {
  const { error } = saved
    ? await supabase.from("saved_stories").upsert({ user_id: userId, story_id: storyId })
    : await supabase.from("saved_stories").delete().eq("user_id", userId).eq("story_id", storyId);
  if (error) throw new Error(`gardées : ${error.message}`);
  return saved;
}

/** Les stories gardées, de la plus récemment gardée à la plus ancienne (celles encore visibles). */
export async function loadSavedStories(userId: string): Promise<Story[]> {
  const { data, error } = await supabase.from("saved_stories").select(`saved_at, stories(${STORY_COLUMNS})`)
    .eq("user_id", userId).order("saved_at", { ascending: false });
  if (error) throw new Error(`gardées : ${error.message}`);
  return (data ?? []).map((r) => (r as unknown as { stories: Story | null }).stories).filter((s): s is Story => s !== null);
}
