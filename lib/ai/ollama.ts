// Local LLM client (Ollama). Used for the $0 stages: profile/voice extraction,
// query planning, evidence ranking (embeddings), and "draft it".
// NOTE: qwen3:8b ships with thinking mode ON — we force `think: false` so
// structured stages return fast, clean output instead of <think> preambles.
export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
export const OLLAMA_EMBED_MODEL =
  process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

export interface OllamaChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
}

const DEFAULT_TIMEOUT_MS = 45_000;

export async function ollamaChat(args: {
  system?: string;
  prompt: string;
  json?: boolean; // request JSON-formatted output
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<OllamaChatResult> {
  const model = args.model ?? OLLAMA_MODEL;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        think: false, // qwen3 thinking mode off — required for clean structured output
        format: args.json ? "json" : undefined,
        options: { temperature: args.temperature ?? 0.2 },
        messages: [
          ...(args.system ? [{ role: "system", content: args.system }] : []),
          { role: "user", content: args.prompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return {
      text: (data?.message?.content ?? "").trim(),
      inputTokens: data?.prompt_eval_count ?? 0,
      outputTokens: data?.eval_count ?? 0,
      latencyMs: Date.now() - started,
      model,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaEmbed(
  text: string,
  model: string = OLLAMA_EMBED_MODEL,
  timeoutMs = 15_000,
): Promise<number[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
    const data = await res.json();
    const embedding = data?.embedding;
    if (!Array.isArray(embedding)) throw new Error("Ollama embed: no vector");
    return embedding as number[];
  } finally {
    clearTimeout(timer);
  }
}
