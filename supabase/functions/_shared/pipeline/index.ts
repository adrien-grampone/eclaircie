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
  KINDS,
  MAX_TRUST_LEVEL,
  STUDY_SUBJECTS,
  TriageSchema,
  buildTriagePrompt,
  isTriageAccepted,
  parseTriage,
  triageScore,
} from "./triage.ts";
export type { Triage, TriageInput } from "./triage.ts";
export { ClaimSchema, buildDraftPrompt, buildRevisePrompt, decideRevise, draftOutputSchema, draftRules, draftSchema, parseDraft } from "./draft.ts";
export type { Draft, DraftOutput, ReviseOptions, ReviseStep } from "./draft.ts";
export { checkEvidence } from "./evidence.ts";
export type { EvidenceCheck } from "./evidence.ts";
export { FATAL_TYPES, PROBLEM_TYPES, VerifyProblemSchema, VerifySchema, buildVerifyPrompt, decideVerify, parseVerify } from "./verify.ts";
export type { Decision, ProblemType, Verify, VerifyContext, VerifyDecision, VerifyProblem } from "./verify.ts";
export { isStockLow, pickForSchedule, scheduleHorizon, sourceWithinShare, stockDays, storyAgeDays } from "./schedule.ts";
export { applyEditorialRules, mainTheme } from "./editorial.ts";
export type { EditorialOutcome } from "./editorial.ts";
export { collectMaxAgeDays, isExpired, isFreshEnough } from "./collect.ts";
export type { ScheduleCandidate, ScheduledStory } from "./schedule.ts";
export { themeOfTheDay } from "./rotation.ts";
export { planBatch, remainingBudget } from "./budget.ts";
export { parseFeed, stripHtml } from "./rss.ts";
export type { FeedItem } from "./rss.ts";
export { classifyExtraction, extractMainText } from "./extract.ts";
export type { ExtractOutcome, Extracted } from "./extract.ts";
export { triageRejectReason } from "./triage.ts";
export type { TriageRejectReason } from "./triage.ts";
export { DedupVerdictSchema, buildDedupPrompt, matchedCandidate, parseDedup, resolveDuplicate } from "./dedup.ts";
export type { DedupCard, DedupDecision, DedupStory, DedupVerdict } from "./dedup.ts";
