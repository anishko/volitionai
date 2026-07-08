// Deep page scrape via Tavily's /extract endpoint — the fallback scrape
// provider when FIRECRAWL_API_KEY is absent (Firecrawl stays preferred where
// configured). Uses the SAME TAVILY_API_KEY the search lane already runs on:
// no new vendor, no new key, no plan change. Returns the same shape as
// firecrawlScrape so lib/events/scrape.ts can treat them interchangeably.
// extract_depth "advanced" — best retrieval on complex/dynamic event pages for
// a small extra credit; thin JS-only SPAs may still return little, in which
// case the local extractor drops the event (citation or no signal — never
// fabricate). Metered as provider "tavily" (Tavily bills), stage event_scrape.

export interface TavilyExtractOutcome {
  url: string;
  markdown: string;
  latencyMs: number;
}

const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

export function tavilyExtractConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function tavilyExtractScrape(
  url: string,
  timeoutMs = 30_000,
): Promise<TavilyExtractOutcome> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set (needed for event page extraction)");
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TAVILY_EXTRACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: url,
        extract_depth: "advanced",
        format: "markdown",
        include_images: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily extract ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    // /extract returns { results: [{ url, raw_content }], failed_results: [...] }.
    // A URL that failed extraction lands in failed_results (empty results) — we
    // throw so the caller counts it as a failed page and drops the event.
    const first = Array.isArray(data?.results) ? data.results[0] : undefined;
    const markdown = first?.raw_content;
    if (typeof markdown !== "string" || markdown.trim().length === 0) {
      throw new Error(`Tavily extract returned no content for ${url}`);
    }
    return { url, markdown, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
