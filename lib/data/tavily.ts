// Web search via Tavily. Returns LLM-ready evidence snippets with real URLs —
// the raw material for citations. Every call is metered (list price logged even
// inside the free tier, per the honest-cost rule).
export interface Evidence {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  source: "tavily" | "propublica" | "eventbrite";
  query: string;
}

export interface TavilySearchOutcome {
  results: Evidence[];
  latencyMs: number;
}

const TAVILY_URL = "https://api.tavily.com/search";

export async function tavilySearch(
  query: string,
  maxResults = 5,
  timeoutMs = 20_000,
): Promise<TavilySearchOutcome> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set (needed for live search)");
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const results: Evidence[] = (data?.results ?? [])
      .filter((r: unknown): r is { url: string } => {
        const url = (r as { url?: unknown })?.url;
        return typeof url === "string" && url.startsWith("http");
      })
      .map((r: Record<string, unknown>) => ({
        url: String(r.url),
        title: String(r.title ?? r.url),
        snippet: String(r.content ?? "").slice(0, 800),
        publishedAt:
          typeof r.published_date === "string" ? r.published_date : undefined,
        source: "tavily" as const,
        query,
      }));
    return { results, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
