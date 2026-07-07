// Cloud LLM client (Anthropic). Used ONLY for the synthesis step — the one
// quality-critical stage — and as a fallback when Ollama is unreachable.
// Server-side only: never import this into a client component.
import Anthropic from "@anthropic-ai/sdk";

// Router: Haiku 4.5 by default, Sonnet 4.6 when QUALITY=high. Both are cheap
// enough to meter honestly; the receipt shows exactly which one ran.
export type CloudModel = "claude-haiku-4-5" | "claude-sonnet-4-6";

export function cloudModel(): CloudModel {
  return process.env.QUALITY === "high" ? "claude-sonnet-4-6" : "claude-haiku-4-5";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (needed for cloud synthesis)");
  }
  client ??= new Anthropic();
  return client;
}

export interface AnthropicResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: CloudModel;
}

/**
 * Single message call. When `jsonSchema` is provided we constrain the output
 * via structured outputs (supported on Haiku 4.5 / Sonnet 4.6) so the response
 * is guaranteed-parseable JSON — no prefill, no schema-drift retries.
 * Note: Haiku 4.5 does not accept `effort`/`thinking`, so we pass neither.
 */
export async function anthropicMessage(args: {
  system: string;
  prompt: string;
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  model?: CloudModel;
}): Promise<AnthropicResult> {
  const model = args.model ?? cloudModel();
  const started = Date.now();

  const res = await getClient().messages.create({
    model,
    max_tokens: args.maxTokens ?? 8000,
    system: args.system,
    messages: [{ role: "user", content: args.prompt }],
    ...(args.jsonSchema
      ? { output_config: { format: { type: "json_schema", schema: args.jsonSchema } } }
      : {}),
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text: text.trim(),
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    latencyMs: Date.now() - started,
    model,
  };
}
