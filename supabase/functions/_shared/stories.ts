import type { Draft } from "./pipeline/draft.ts";
import type { Claim } from "./pipeline/types.ts";
import type { Verify, VerifyDecision } from "./pipeline/verify.ts";

/** Colonnes d'une story lues par verify et revise, avec l'article joint. */
export interface StoryRow {
  id: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  claims: Claim[];
  scene: string | null;
  source_name: string;
  source_url: string;
  verify_log: VerifyLogEntry[];
  raw_articles: { title: string; published_at: string | null; full_text: string } | null;
}

export interface VerifyLogEntry {
  pass: number;
  model: string;
  decision: VerifyDecision;
  reason: string | null;
  verify: Verify;
  at: string;
}

export const STORY_SELECT =
  "id, title_main, title_accent, summary, claims, scene, source_name, source_url, verify_log, raw_articles(title, published_at, full_text)";

export function draftOf(story: StoryRow): Draft {
  return {
    title_main: story.title_main,
    title_accent: story.title_accent ?? "",
    summary: story.summary,
    claims: story.claims,
    scene: story.scene ?? "",
  };
}
