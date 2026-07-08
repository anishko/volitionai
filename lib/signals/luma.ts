// STAGE: community-event discovery — Luma via Firecrawl (PRD v4, amendment #3).
// Luma has no topic-searchable public API, so we scrape PUBLIC Luma discovery /
// calendar pages with Firecrawl and extract event links. We CHECK robots.txt
// first and skip any disallowed path (logged in MOCKED.md) — we never scrape
// what a site disallows. Every event carries its lu.ma URL as source_url
// (citation or no signal); metered as a Firecrawl page (its real cost).
// Degrades cleanly (no throw, a notice) when unconfigured.
import { CostMeter } from "@/lib/ai/cost";
import { firecrawlMarkdown, firecrawlConfigured } from "./firecrawl-events";
import type { EventWithRoi, NonprofitProfileForMatch } from "@/types";

// A public Luma discovery/calendar page to scrape (e.g. a city or topic
// calendar). Left unset by default so we never scrape without explicit intent.
function lumaDiscoveryUrl(): string | undefined {
  return process.env.LUMA_DISCOVERY_URL || undefined;
}

/** Minimal robots.txt check for the User-agent:* group. Returns false only on an
 *  explicit Disallow match; missing/unreachable robots.txt ⇒ allowed (standard). */
export async function robotsAllows(targetUrl: string, timeoutMs = 8_000): Promise<boolean> {
  let origin: string;
  let path: string;
  try {
    const u = new URL(targetUrl);
    origin = u.origin;
    path = u.pathname || "/";
  } catch {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
    if (!res.ok) return true; // no robots.txt ⇒ allowed
    const txt = await res.text();

    // Collect Disallow rules under the User-agent:* group (simplified).
    const disallows: string[] = [];
    let inStar = false;
    for (const raw of txt.split("\n")) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey.trim().toLowerCase();
      const val = rest.join(":").trim();
      if (key === "user-agent") inStar = val === "*";
      else if (inStar && key === "disallow" && val) disallows.push(val);
    }
    return !disallows.some((rule) => path.startsWith(rule));
  } catch {
    return true; // unreachable robots.txt ⇒ allowed
  } finally {
    clearTimeout(timer);
  }
}

/** Extract lu.ma event links from scraped page markdown. Each becomes a
 *  candidate whose website (source_url) is the event's own lu.ma URL. */
function extractLumaEvents(markdown: string): EventWithRoi[] {
  const now = new Date().toISOString();
  const seen = new Map<string, EventWithRoi>();
  // Markdown links [name](https://lu.ma/<slug>) — slug is not "discover"/known non-event paths.
  const re = /\[([^\]]{1,120})\]\((https?:\/\/lu\.ma\/([a-z0-9-]+))\)/gi;
  const skip = new Set(["discover", "home", "signin", "create", "pricing", "about"]);
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const [, name, url, slug] = m;
    if (skip.has(slug.toLowerCase()) || seen.has(url)) continue;
    seen.set(url, {
      id: `luma_${slug}`,
      name: name.trim() || "Luma event",
      website: url,
      format: undefined, // unknown until the event page is scraped; never guessed
      causeAreaTags: [],
      causeSubTags: [],
      isSeed: false,
      speakers: [],
      sponsors: [],
      organizerContacts: [],
      participationTiers: [],
      donorSignals: [],
      timingSignals: [],
      certificatesOffered: [],
      scrapeCount: 1,
      lastScrapedAt: now,
      createdAt: now,
    });
  }
  return [...seen.values()];
}

export interface LumaDiscoveryResult {
  results: EventWithRoi[];
  degraded: string[];
}

export async function lumaDiscover(
  meter: CostMeter,
  _profile: NonprofitProfileForMatch,
): Promise<LumaDiscoveryResult> {
  const degraded: string[] = [];
  const url = lumaDiscoveryUrl();

  if (!firecrawlConfigured() || !url) {
    degraded.push(
      "Luma unconfigured (needs FIRECRAWL_API_KEY + LUMA_DISCOVERY_URL) — community-event discovery skipped",
    );
    return { results: [], degraded };
  }

  if (!(await robotsAllows(url))) {
    // Respect robots.txt — skip and surface it (MOCKED.md records this behavior).
    degraded.push(`Luma robots.txt disallows ${url} — skipped per robots policy`);
    return { results: [], degraded };
  }

  const started = Date.now();
  try {
    const markdown = await firecrawlMarkdown(url);
    meter.firecrawl({ stage: "event_search", pages: 1, latencyMs: Date.now() - started });
    return { results: extractLumaEvents(markdown), degraded };
  } catch (err) {
    console.warn("[luma] Firecrawl scrape failed:", err instanceof Error ? err.message : err);
    degraded.push("Luma scrape failed — community-event discovery skipped this run");
    return { results: [], degraded };
  }
}
