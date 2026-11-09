import type { Draft } from "./pipeline/draft.ts";
import { KINDS, STUDY_SUBJECTS, type Triage } from "./pipeline/triage.ts";
import type { Claim } from "./pipeline/types.ts";
import type { Verify, VerifyDecision } from "./pipeline/verify.ts";

/** Colonnes d'une story lues par verify et revise, avec l'article joint. */
export interface StoryRow {
  id: string;
  theme_id: string;
  status: string;
  title_main: string;
  title_accent: string | null;
  summary: string;
  claims: Claim[];
  scene: string | null;
  source_name: string;
  source_url: string;
  verify_log: VerifyLogEntry[];
  /** Journal de vérification d'avant une reprise (`to_rework`) ; non nul = la nouvelle est en cours de reprise. */
  previous_verify_log: VerifyLogEntry[] | null;
  raw_articles: {
    title: string;
    published_at: string | null;
    full_text: string;
    /** Triage de l'article : kind et study_subject servent à valider un changement de thème. */
    triage: { kind?: string | null; study_subject?: string | null } | null;
  } | null;
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
  "id, theme_id, status, title_main, title_accent, summary, claims, scene, source_name, source_url, verify_log, previous_verify_log, raw_articles(title, published_at, full_text, triage)";

/** kind et study_subject du triage, bornés aux valeurs connues (null sinon). */
export function triageOf(story: StoryRow): Pick<Triage, "kind" | "study_subject"> {
  const t = story.raw_articles?.triage;
  const kind = KINDS.find((k) => k === t?.kind) ?? null;
  const study_subject = STUDY_SUBJECTS.find((s) => s === t?.study_subject) ?? null;
  return { kind, study_subject };
}

export function draftOf(story: StoryRow): Draft {
  return {
    title_main: story.title_main,
    title_accent: story.title_accent ?? "",
    summary: story.summary,
    claims: story.claims,
    scene: story.scene ?? "",
  };
}

/** Une nouvelle en cours de reprise (à réécrire, ou révision qui en découle) : budget max_rework_per_day. */
export function isRework(story: Pick<StoryRow, "status" | "previous_verify_log">): boolean {
  return story.status === "to_rework" || story.previous_verify_log !== null;
}
