/**
 * Embeddings via l'API Voyage AI (recommandée par Anthropic), appelée en fetch :
 * pas de SDK. La dimension de sortie est imposée à 1024 pour coller à stories.embedding.
 */
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
export const EMBEDDING_DIMENSIONS = 1024;

interface VoyageResponse {
  data?: { embedding: number[]; index: number }[];
  detail?: string;
}

export async function embedTexts(texts: readonly string[], model: string): Promise<number[][]> {
  const apiKey = Deno.env.get("VOYAGE_API_KEY");
  if (!apiKey) throw new Error("VOYAGE_API_KEY manquante dans les secrets des Edge Functions");
  const response = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ input: texts, model, input_type: "document", output_dimension: EMBEDDING_DIMENSIONS }),
  });
  const body = (await response.json()) as VoyageResponse;
  if (!response.ok || !body.data) throw new Error(`Voyage ${response.status}: ${body.detail ?? "réponse inattendue"}`);
  const sorted = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (sorted.length !== texts.length || sorted.some((e) => e.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("Voyage : nombre ou dimension d'embeddings inattendus");
  }
  return sorted;
}
