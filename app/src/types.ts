import type { Palette } from "@/theme/tokens.ts";

export interface Theme {
  id: string;
  label: string;
  position: number;
  palette: Palette;
  active: boolean;
  coming_soon: boolean;
}

/** Colonnes de `stories` visibles par l'app (RLS : programmées et publiées). */
export interface Story {
  id: string;
  theme_id: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  source_name: string;
  source_url: string;
  source_date: string | null;
  image_path: string | null;
  publish_date: string;
  /** `scheduled` (publiée) ou `retracted` (retirée après vérification : l'app n'affiche que ce statut). */
  status: "scheduled" | "retracted";
}

export const STORY_COLUMNS = "id, theme_id, title_main, title_accent, summary, source_name, source_url, source_date, image_path, publish_date, status";

export interface Profile {
  user_id: string;
  themes: string[];
  notify_time: string;
  timezone: string;
  created_at: string;
}
