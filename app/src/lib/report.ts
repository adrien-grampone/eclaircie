/** Signalement d'une erreur sur une nouvelle (spec §8) : logique pure. */

export const REPORT_REASONS = [
  { id: "inaccurate", label: "Fait inexact" },
  { id: "source_missing", label: "Source introuvable" },
  { id: "not_good_news", label: "Pas une bonne nouvelle" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export const REPORT_MESSAGE_MAX = 500;

export const REPORT_COPY = {
  title: "Signaler une erreur",
  help: "Dis-nous ce qui cloche, on vérifie.",
  placeholder: "Précisions (facultatif)",
  send: "Envoyer",
  thanksTitle: "Merci.",
  thanksBody: "On relit la nouvelle et sa source. Si l'erreur est confirmée, elle est retirée.",
  close: "Fermer",
} as const;

export interface ReportInput {
  userId: string;
  storyId: string;
  reason: ReportReason | null;
  message: string;
}

export interface ReportRow {
  user_id: string;
  story_id: string;
  reason: ReportReason | null;
  message: string | null;
}

export type ReportValidation = { ok: true; row: ReportRow } | { ok: false; reason: string };

/** Une raison rapide ou un message (ou les deux) ; le message est nettoyé et borné. */
export function buildReport(input: ReportInput): ReportValidation {
  const message = input.message.trim();
  if (!input.reason && message === "") return { ok: false, reason: "choisis une raison ou écris un mot" };
  if (message.length > REPORT_MESSAGE_MAX) return { ok: false, reason: `message trop long (${message.length}/${REPORT_MESSAGE_MAX})` };
  if (input.reason && !REPORT_REASONS.some((r) => r.id === input.reason)) return { ok: false, reason: "raison inconnue" };
  return { ok: true, row: { user_id: input.userId, story_id: input.storyId, reason: input.reason, message: message === "" ? null : message } };
}

/** Code Postgres d'unicité violée : l'utilisateur a déjà signalé cette nouvelle. */
export const UNIQUE_VIOLATION = "23505";

export function reportFailureMessage(code: string | undefined): string {
  if (code === UNIQUE_VIOLATION) return "Tu as déjà signalé cette nouvelle, merci.";
  return "Envoi impossible pour le moment. Réessaie plus tard.";
}
