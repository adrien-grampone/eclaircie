import { toIsoDate } from "@pipeline/dates.ts";
import { alsoToday, pastEntries } from "./archive.ts";
import { supabase } from "./supabase.ts";
import { STORY_COLUMNS, type Story } from "@/types.ts";

/** Plafond de lignes lues pour les Archives (la pagination se fait ensuite en pur). */
const ARCHIVE_FETCH_MAX = 200;

export interface ArchiveData {
  today: string;
  /** Les nouvelles du jour des thèmes de l'utilisateur (RLS : validées seulement). */
  alsoToday: Story[];
  /** Les jours passés, du plus récent au plus ancien, retirées comprises. */
  past: Story[];
}

/** Stories visibles des thèmes de l'utilisateur, jusqu'à aujourd'hui, les plus récentes d'abord. */
export async function loadArchive(themes: readonly string[], shownStoryId: string | null = null): Promise<ArchiveData> {
  const today = toIsoDate(new Date());
  const { data, error } = await supabase.from("stories").select(STORY_COLUMNS)
    .in("theme_id", themes).lte("publish_date", today)
    .order("publish_date", { ascending: false }).limit(ARCHIVE_FETCH_MAX);
  if (error) throw new Error(`archives : ${error.message}`);
  const stories = data as Story[];
  return { today, alsoToday: alsoToday(stories, today, shownStoryId), past: pastEntries(stories, today) };
}

/** Une story visible par son identifiant (null si absente ou invisible). */
export async function loadStory(id: string): Promise<Story | null> {
  const { data, error } = await supabase.from("stories").select(STORY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`nouvelle : ${error.message}`);
  return (data as Story | null) ?? null;
}
