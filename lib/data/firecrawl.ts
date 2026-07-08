// Deep page scrape via Firecrawl. Used for JS-heavy event pages that Tavily
// snippets can't cover: the markdown output feeds LOCAL structured extraction.
// Every scraped page is metered (list price logged even inside trial credits,
// per the honest-cost rule).

export interface FirecrawlScrapeOutcome {
  url: string;
  markdown: string;
  latencyMs: number;
}

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

export function firecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export async function firecrawlScrape(
  url: string,
  timeoutMs = 30_000,
): Promise<FirecrawlScrapeOutcome> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not set (needed for event page scraping)");
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: timeoutMs - 5_000,
      }),
    });
    if (!res.ok) {
      throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const markdown = data?.data?.markdown;
    if (typeof markdown !== "string" || markdown.trim().length === 0) {
      throw new Error(`Firecrawl returned no markdown for ${url}`);
    }
    return { url, markdown, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
