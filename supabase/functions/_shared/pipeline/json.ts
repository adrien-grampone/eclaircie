import type { z } from "zod";
import type { ParseResult } from "./types.ts";

/**
 * Isole l'objet JSON dans une réponse de modèle : retire les clôtures ```json,
 * le texte avant la première accolade et après la dernière.
 */
export function extractJsonObject(text: string): string | null {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return unfenced.slice(start, end + 1);
}

/** Rend les erreurs Zod lisibles dans les logs : `summary: Too big…; claims: …`. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/** Extrait, parse et valide un JSON de réponse de modèle contre un schéma Zod. */
export function parseJsonWith<T>(schema: z.ZodType<T>, text: string): ParseResult<T> {
  const raw = extractJsonObject(text);
  if (raw === null) {
    return { ok: false, error: "Aucun objet JSON trouvé dans la réponse" };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, error: `JSON malformé : ${message}` };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: formatIssues(result.error) };
  }
  return { ok: true, value: result.data };
}
