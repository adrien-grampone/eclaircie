import { z } from "zod";
import type { PipelineConfig } from "./config.ts";
import { parseJsonWith } from "./json.ts";
import type { ParseResult, Prompt } from "./types.ts";

/**
 * Étape `dedup` (§4.6, version sans embeddings) — Claude Haiku compare la story à
 * tester aux stories du même thème sur `dedup_window_days` jours et désigne, le cas
 * échéant, celle qui rapporte le même événement. La décision reste en code : la
 * source la mieux notée gagne, une story programmée n'est jamais remplacée.
 */

export interface DedupStory {
  id: string;
  trustLevel: number;
  status: string;
  /** timestamptz ISO ; à égalité de confiance, la plus ancienne gagne. */
  createdAt: string;
}

/** Ce que le modèle voit d'une story : identifiant, titre, résumé, source, date. */
export interface DedupCard {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceDate: string | null;
}

export const DedupVerdictSchema = z.object({
  duplicate_of: z.string().trim().min(1).nullable(),
  reason: z.string().trim().min(1),
});
export type DedupVerdict = z.infer<typeof DedupVerdictSchema>;

export function parseDedup(json: string): ParseResult<DedupVerdict> {
  return parseJsonWith(DedupVerdictSchema, json);
}

/**
 * L'identifiant désigné doit être l'un des candidats proposés ; sinon on considère
 * la story unique (le modèle a halluciné un identifiant) et on le signale.
 */
export function matchedCandidate<T extends { id: string }>(verdict: DedupVerdict, candidates: readonly T[]): T | null {
  if (verdict.duplicate_of === null) return null;
  return candidates.find((c) => c.id === verdict.duplicate_of) ?? null;
}

export type DedupDecision =
  | { decision: "unique" }
  | { decision: "reject_story"; duplicateOf: string }
  | { decision: "keep_story"; rejectIds: string[] };

/** Statuts d'une story existante qu'une nouvelle venue mieux sourcée peut remplacer. */
const REPLACEABLE = new Set(["verified", "illustrated", "approved"]);

/**
 * - pas de doublon → unique ;
 * - le doublon est déjà programmé, ou mieux sourcé, ou aussi bien sourcé mais plus ancien → la story est rejetée ;
 * - sinon la story gagne et le doublon est rejeté.
 */
export function resolveDuplicate(story: DedupStory, duplicate: DedupStory | null): DedupDecision {
  if (!duplicate) return { decision: "unique" };
  const duplicateWins =
    !REPLACEABLE.has(duplicate.status) ||
    duplicate.trustLevel > story.trustLevel ||
    (duplicate.trustLevel === story.trustLevel && duplicate.createdAt <= story.createdAt);
  return duplicateWins
    ? { decision: "reject_story", duplicateOf: duplicate.id }
    : { decision: "keep_story", rejectIds: [duplicate.id] };
}

function card(c: DedupCard): string {
  return [`id : ${c.id}`, `source : ${c.sourceName}${c.sourceDate ? ` (${c.sourceDate})` : ""}`, `titre : ${c.title}`, `résumé : ${c.summary}`].join("\n");
}

export function buildDedupPrompt(
  story: DedupCard,
  candidates: readonly DedupCard[],
  config: Pick<PipelineConfig, "dedup_window_days">,
): Prompt {
  const system = [
    "Tu détectes les doublons pour une application qui publie une bonne nouvelle par jour et par thème. Deux nouvelles sont des doublons quand elles rapportent le MÊME ÉVÉNEMENT (même fait, même lieu, même acteurs, même période), même si les angles, les sources ou les chiffres mis en avant diffèrent.",
    "",
    "Ne sont PAS des doublons : deux événements distincts sur un même sujet (deux aires protégées différentes, deux études différentes sur les coraux), une suite ou une mise à jour avec un fait nouveau, ou une simple proximité de thème.",
    "",
    `Tu reçois la nouvelle à tester, puis les nouvelles déjà retenues sur le même thème ces ${config.dedup_window_days} derniers jours, chacune avec son id. Réponds UNIQUEMENT avec un objet JSON strict :`,
    "{",
    '  "duplicate_of": "<id exact de la nouvelle déjà retenue qui rapporte le même événement, ou null>",',
    '  "reason": "une phrase en français qui justifie"',
    "}",
    "",
    "Au moindre doute sérieux sur l'identité de l'événement, réponds null : un doublon manqué coûte moins qu'une vraie nouvelle écartée à tort. Si plusieurs candidates rapportent le même événement, choisis la plus proche.",
  ].join("\n");

  const user = [
    "NOUVELLE À TESTER",
    card(story),
    "",
    candidates.length === 0 ? "NOUVELLES DÉJÀ RETENUES : aucune" : "NOUVELLES DÉJÀ RETENUES",
    ...candidates.map((c, i) => `--- candidate ${i + 1} ---\n${card(c)}`),
  ].join("\n");

  return { system, user };
}
