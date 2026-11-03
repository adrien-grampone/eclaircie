import type { PipelineConfig } from "./config.ts";
import { dateOfTimestamp, daysBetween } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/** Une story `approved` non programmée, candidate pour un jour donné. */
export interface ScheduleCandidate {
  id: string;
  sourceName: string;
  /** `stories.source_date` ; si null, l'âge est calculé depuis `createdAt`. */
  sourceDate: IsoDate | null;
  /** `stories.created_at` (timestamptz ISO). */
  createdAt: string;
  evergreen: boolean;
  score: number;
}

/** Une story déjà programmée sur le même thème. */
export interface ScheduledStory {
  publishDate: IsoDate;
  sourceName: string;
}

type ScheduleConfig = Pick<PipelineConfig, "schedule_recent_days" | "schedule_max_age_days">;

/** Âge en jours d'une story au jour `day`, jamais négatif. */
export function storyAgeDays(candidate: ScheduleCandidate, day: IsoDate): number {
  const reference = candidate.sourceDate ?? dateOfTimestamp(candidate.createdAt);
  return Math.max(0, daysBetween(reference, day));
}

/** Niveau de priorité : 0 récente, 1 intemporelle, 2 autre encore programmable. */
function tierOf(age: number, candidate: ScheduleCandidate, config: ScheduleConfig): number {
  if (age < config.schedule_recent_days) return 0;
  if (candidate.evergreen) return 1;
  return 2;
}

function sameSource(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Choisit la story à programmer pour `day` sur UN thème (§4.9).
 * `candidates` et `alreadyScheduled` concernent ce thème uniquement.
 *
 * - récentes (< schedule_recent_days) d'abord, puis intemporelles, puis le reste ;
 * - jamais une non-intemporelle de plus de schedule_max_age_days ;
 * - pas la même source que la veille ou le lendemain déjà programmés ;
 * - à égalité : meilleur score, puis plus récente, puis id (déterminisme).
 *
 * Renvoie null si rien n'est programmable, ou si `day` est déjà pris.
 */
export function pickForSchedule(
  candidates: readonly ScheduleCandidate[],
  alreadyScheduled: readonly ScheduledStory[],
  day: IsoDate,
  config: ScheduleConfig,
): ScheduleCandidate | null {
  if (alreadyScheduled.some((s) => s.publishDate === day)) return null;

  const neighbourSources = alreadyScheduled
    .filter((s) => Math.abs(daysBetween(s.publishDate, day)) === 1)
    .map((s) => s.sourceName);

  const ranked = candidates
    .map((candidate) => ({ candidate, age: storyAgeDays(candidate, day) }))
    .filter(({ candidate, age }) => candidate.evergreen || age <= config.schedule_max_age_days)
    .filter(({ candidate }) => !neighbourSources.some((s) => sameSource(s, candidate.sourceName)))
    .map((entry) => ({ ...entry, tier: tierOf(entry.age, entry.candidate, config) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.candidate.score !== b.candidate.score) return b.candidate.score - a.candidate.score;
      if (a.age !== b.age) return a.age - b.age;
      return a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0;
    });

  return ranked[0]?.candidate ?? null;
}
