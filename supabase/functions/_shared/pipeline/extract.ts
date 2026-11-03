import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { PipelineConfig } from "./config.ts";

export interface Extracted {
  title: string | null;
  text: string;
}

/** Résultat de l'étape extract (§4.3) : texte complet ou raison d'échec. */
export type ExtractOutcome =
  | { ok: true; text: string; title: string | null }
  | { ok: false; reason: "no_fulltext" };

/**
 * Extrait le texte principal d'une page HTML avec Readability sur un DOM linkedom.
 * Pur : prend le HTML déjà téléchargé. Renvoie null si rien d'exploitable.
 */
export function extractMainText(html: string, _url: string): Extracted | null {
  if (!html.trim()) return null;
  const { document } = parseHTML(html);
  let article: ReturnType<Readability["parse"]>;
  try {
    article = new Readability(document as unknown as Document, { charThreshold: 0 }).parse();
  } catch {
    return null;
  }
  if (!article) return null;
  const text = (article.textContent ?? "").replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  if (!text) return null;
  return { title: article.title?.trim() || null, text };
}

/**
 * Applique la règle de §4.3 : paywall ou texte sous `extract_min_chars` → `no_fulltext`.
 * On ne résume jamais à partir d'un simple extrait RSS.
 */
export function classifyExtraction(
  extracted: Extracted | null,
  config: Pick<PipelineConfig, "extract_min_chars">,
): ExtractOutcome {
  if (!extracted || extracted.text.length < config.extract_min_chars) {
    return { ok: false, reason: "no_fulltext" };
  }
  return { ok: true, text: extracted.text, title: extracted.title };
}
