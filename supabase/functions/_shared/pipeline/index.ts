/**
 * Logique métier pure du pipeline Éclaircie.
 * Aucun appel réseau, aucun accès base : tout est testable en Vitest.
 */
export type { Article, Claim, IsoDate, ParseResult, Prompt, ThemeRef } from "./types.ts";
export { addDays, dateOfTimestamp, daysBetween, isIsoDate, toIsoDate } from "./dates.ts";
export { PipelineConfigSchema, parseConfig } from "./config.ts";
export type { ConfigRow, PipelineConfig } from "./config.ts";
export { extractJsonObject, parseJsonWith } from "./json.ts";
export { normalizeText } from "./normalize.ts";
export {
  MAX_TRUST_LEVEL,
  TriageSchema,
  buildTriagePrompt,
  isTriageAccepted,
  parseTriage,
  triageScore,
} from "./triage.ts";
export type { Triage, TriageInput } from "./triage.ts";
export { ClaimSchema, buildDraftPrompt, draftSchema, parseDraft } from "./draft.ts";
export type { Draft } from "./draft.ts";
export { checkEvidence } from "./evidence.ts";
export type { EvidenceCheck } from "./evidence.ts";
export { VerifySchema, buildVerifyPrompt, isVerifyPassed, parseVerify } from "./verify.ts";
export type { Verify } from "./verify.ts";
export { pickForSchedule, storyAgeDays } from "./schedule.ts";
export type { ScheduleCandidate, ScheduledStory } from "./schedule.ts";
export { themeOfTheDay } from "./rotation.ts";
