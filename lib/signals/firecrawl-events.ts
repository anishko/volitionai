// STAGE: event scraping (Firecrawl deep-scrape → LOCAL structured extraction).
// Firecrawl fetches the page markdown; qwen3 ($0) extracts structured event
// fields. EVERY extracted field is stamped with source_url (the page it came
// from) + scraped_at IN CODE — never by the model — so "citation or no signal"
// holds mechanically. Hard cap of FIRECRAWL_PAGE_CAP pages/run.
// Degrades cleanly when FIRECRAWL_API_KEY is absent: no throw, a notice, and
// the pipeline continues on the seed corpus (PRD failure modes).
import { ollamaChat } from "@/lib/ai/ollama";
import { CostMeter } from "@/lib/ai/cost";
import {
  ScrapedEventSchema,
  FIRECRAWL_PAGE_CAP,
  looseJsonParse,
  todayStr,
  type ScrapedEvent,
} from "./schema";
import type { EventWithRoi } from "@/types";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

const EXTRACT_SYSTEM = `You extract structured facts about a single event from scraped web page text.
Return ONLY JSON matching this shape:
{"name": string, "startDate": "YYYY-MM-DD"|omit, "endDate": "YYYY-MM-DD"|omit,
 "locationCity": string|omit, "locationState": string|omit, "locationCountry": string|omit,
 "format": "in_person"|"virtual"|"hybrid"|omit,
 "causeAreaTags": string[], "participationTiers": [{"tier","cost"?,"deadline"?,"applyUrl"?,"instructions"?}],
 "speakers": [{"name","title"?,"org"?}], "sponsors": [{"name"}],
 "organizerContacts": [{"name","role"?,"email"?}], "certificatesOffered": [{"type"}]}
Rules:
- ONLY include a field if it is explicitly present in the text. Never guess a date, cost, email, or name.
- Omit anything you cannot find. An empty array is correct when nothing is stated.
- DATE GROUNDING: dates must be real dates found in the text; do not infer or shift them.`;

/** True when a Firecrawl key is configured. Callers check this to decide
 *  whether to attempt live scraping or degrade to the seed corpus. */
export function firecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

// Exported so the Luma adapter (lib/signals/luma.ts) reuses the same Firecrawl
// scrape path (and the same metering discipline via meter.firecrawl).
export async function firecrawlMarkdown(url: string, timeoutMs = 25_000): Promise<string> {
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
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const md = data?.data?.markdown ?? data?.markdown ?? "";
    if (typeof md !== "string" || md.length === 0) throw new Error("Firecrawl: empty markdown");
    return md;
  } finally {
    clearTimeout(timer);
  }
}

export interface ScrapeResult {
  events: EventWithRoi[];
  pagesScraped: number;
  stoppedAtBudget: boolean;
  failed: number;
  degraded: string[];
}

/** Scrape up to FIRECRAWL_PAGE_CAP pages into EventWithRoi rows. Each row's
 *  nested items (tiers, speakers, sponsors, contacts, certificates) carry the
 *  page url as source_url and now as scraped_at/verified_at. */
export async function scrapeEventPages(
  meter: CostMeter,
  urls: string[],
  opts: { pageCap?: number } = {},
): Promise<ScrapeResult> {
  const cap = opts.pageCap ?? FIRECRAWL_PAGE_CAP;
  const degraded: string[] = [];

  if (!firecrawlConfigured()) {
    degraded.push("Firecrawl unconfigured — live event scraping skipped; matching runs on the seed corpus");
    return { events: [], pagesScraped: 0, stoppedAtBudget: false, failed: 0, degraded };
  }

  const unique = [...new Set(urls)].filter((u) => /^https?:\/\//.test(u));
  const events: EventWithRoi[] = [];
  let pagesScraped = 0;
  let failed = 0;
  let stoppedAtBudget = false;
  const fcStart = Date.now();

  for (const url of unique) {
    if (pagesScraped >= cap) {
      stoppedAtBudget = true;
      break;
    }
    try {
      const markdown = await firecrawlMarkdown(url);
      pagesScraped += 1;
      const scraped = await extractStructured(meter, url, markdown);
      if (scraped) events.push(scrapedToEvent(scraped, url));
    } catch (err) {
      failed += 1;
      console.warn(
        `[firecrawl-events] scrape failed for ${url}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  meter.firecrawl({ stage: "event_scrape", pages: pagesScraped, latencyMs: Date.now() - fcStart });
  if (stoppedAtBudget) degraded.push(`Firecrawl budget reached (${cap} pages) — remaining pages skipped`);

  return { events, pagesScraped, stoppedAtBudget, failed, degraded };
}

async function extractStructured(
  meter: CostMeter,
  url: string,
  markdown: string,
): Promise<ScrapedEvent | null> {
  const prompt = `TODAY'S DATE: ${todayStr()}.
SOURCE URL: ${url}
PAGE TEXT (truncated):
${markdown.slice(0, 8000)}

Return the structured JSON now.`;
  try {
    const r = await ollamaChat({ system: EXTRACT_SYSTEM, prompt, json: true });
    meter.ollama({
      stage: "event_scrape",
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      latencyMs: r.latencyMs,
    });
    return ScrapedEventSchema.parse(looseJsonParse(r.text));
  } catch (err) {
    console.warn(
      `[firecrawl-events] structured extraction failed for ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Map a validated ScrapedEvent + its page url into an EventWithRoi, stamping
 *  source_url + verified_at/scraped_at on every sourced item. */
function scrapedToEvent(s: ScrapedEvent, url: string): EventWithRoi {
  const now = new Date().toISOString();
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw url as website fallback */
  }
  return {
    id: `scraped_${host}_${(s.name ?? "event").toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
    name: s.name ?? host,
    website: url,
    startDate: s.startDate,
    endDate: s.endDate,
    locationCity: s.locationCity,
    locationState: s.locationState,
    locationCountry: s.locationCountry,
    format: s.format,
    causeAreaTags: s.causeAreaTags,
    causeSubTags: [],
    isSeed: false,
    speakers: s.speakers.map((sp) => ({ ...sp, sourceUrl: url })),
    sponsors: s.sponsors.map((sp) => ({ ...sp, sourceUrl: url })),
    organizerContacts: s.organizerContacts.map((c) => ({ ...c, sourceUrl: url })),
    participationTiers: s.participationTiers.map((t) => ({ ...t, sourceUrl: url, verifiedAt: now })),
    donorSignals: [],
    timingSignals: [],
    certificatesOffered: s.certificatesOffered.map((c) => ({ type: c.type, sourceUrl: url })),
    scrapeCount: 1,
    lastScrapedAt: now,
    createdAt: now,
  };
}
