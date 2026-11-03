import Anthropic from "@anthropic-ai/sdk";
import type { Prompt } from "./pipeline/types.ts";

/** Tout sur Haiku 5.5 : 20× moins cher que Sonnet 5.5 par token (décision du 2026-11-03, budget API). */
export const MODELS = {
  triage: "claude-haiku-5-5",
  draft: "claude-haiku-5-5",
  verify: "claude-haiku-5-5",
  dedup: "claude-haiku-5-5",
} as const;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante dans les secrets des Edge Functions");
    client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  }
  return client;
}

export interface ModelReply {
  text: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Un appel, une réponse texte. Le prompt système est marqué pour le cache :
 * il est identique d'un article à l'autre, seul le message utilisateur change.
 */
export async function askModel(
  model: string,
  prompt: Prompt,
  options: { maxTokens: number; effort: "low" | "medium" | "high"; thinking: boolean },
): Promise<ModelReply> {
  const response = await anthropic().messages.create({
    model,
    max_tokens: options.maxTokens,
    // Sans raisonnement pour une classification JSON courte : le raisonnement adaptatif
    // compterait dans max_tokens. Autorisé à effort ≤ high sur Haiku 5.5.
    thinking: options.thinking ? { type: "adaptive" } : { type: "disabled" },
    output_config: { effort: options.effort },
    system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt.user }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return {
    text,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
