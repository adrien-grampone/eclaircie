import type { Claim } from "@pipeline/types.ts";

export interface ThemeRow {
  id: string;
  label: string;
  position: number;
  palette: Record<string, string>;
  palette_words: string;
  active: boolean;
  coming_soon: boolean;
}

export type StoryStatus = "drafted" | "to_revise" | "verified" | "illustrated" | "approved" | "scheduled" | "rejected" | "retracted";

export interface StoryRow {
  id: string;
  theme_id: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  claims: Claim[];
  scene: string | null;
  source_name: string;
  source_url: string;
  source_date: string | null;
  score: number;
  evergreen: boolean;
  image_path: string | null;
  status: StoryStatus;
  reject_reason: string | null;
  publish_date: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface AlertRow {
  id: number;
  kind: string;
  fingerprint: string;
  theme_id: string | null;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RunRow {
  id: number;
  step: string;
  started_at: string;
  processed: number | null;
  succeeded: number | null;
  failed: number | null;
  error: string | null;
}

export interface ReportRow {
  id: string;
  story_id: string | null;
  message: string | null;
  created_at: string;
  stories: Pick<StoryRow, "id" | "title_main" | "title_accent" | "status" | "publish_date" | "theme_id"> | null;
}
