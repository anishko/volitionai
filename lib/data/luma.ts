// Community-event discovery — Luma via Firecrawl (PRD v4, amendment #3). Luma
// has no topic-searchable public API, so we scrape a PUBLIC Luma discovery /
// calendar page with Firecrawl and extract event links. We CHECK robots.txt
// FIRST and skip any disallowed path (logged in MOCKED.md) — we never scrape
// what a site disallows. Every event carries its lu.ma URL as source_url
// (citation or no signal); metered as the Firecrawl page it really is. No-ops
// cleanly (with a notice) when unconfigured.
import { CostMeter } from "@/lib/ai/cost";
import { firecrawlConfigured, firecrawlScrape } from "./firecrawl";
import type { CommunityEvent } from "./community";
import type { CommunityDiscoveryOutcome } from "./meetup";

// A public Luma discovery/calendar page to scrape (e.g. a city or topic
// calendar). Unset by default so we never scrape without explicit intent.
function lumaDiscoveryUrl(): string | undefined {
  return process.env.LUMA_DISCOVERY_URL || undefined;
}

export function lumaConfigured(): boolean {
  return firecrawlConfigured() && Boolean(lumaDiscoveryUrl());
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
 *  candidate whose sourceUrl is the event's own lu.ma URL. */
function extractLumaEvents(markdown: string): CommunityEvent[] {
  const seen = new Map<string, CommunityEvent>();
  // Markdown links [name](https://lu.ma/<slug>) — slug not a known non-event path.
  const re = /\[([^\]]{1,120})\]\((https?:\/\/lu\.ma\/([a-z0-9-]+))\)/gi;
  const skip = new Set(["discover", "home", "signin", "create", "pricing", "about"]);
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const [, name, url, slug] = m;
    if (skip.has(slug.toLowerCase()) || seen.has(url)) continue;
    seen.set(url, {
      source: "luma",
      name: name.trim() || "Luma event",
      sourceUrl: url,
      // format/date unknown until the event page itself is scraped; never guessed.
    });
  }
  return [...seen.values()];
}

export async function lumaDiscover(meter: CostMeter): Promise<CommunityDiscoveryOutcome> {
  const notices: string[] = [];
  const url = lumaDiscoveryUrl();

  if (!firecrawlConfigured() || !url) {
    notices.push(
      "Luma not configured (needs FIRECRAWL_API_KEY + LUMA_DISCOVERY_URL); community events skipped.",
    );
    return { events: [], notices };
  }

  if (!(await robotsAllows(url))) {
    // Respect robots.txt — skip and surface it (MOCKED.md records this behavior).
    notices.push(`Luma robots.txt disallows ${url} — skipped per robots policy.`);
    return { events: [], notices };
  }

  const started = Date.now();
  try {
    const page = await firecrawlScrape(url);
    meter.firecrawl({ stage: "event_search", pages: 1, latencyMs: Date.now() - started });
    return { events: extractLumaEvents(page.markdown), notices };
  } catch (err) {
    console.warn("[luma] Firecrawl scrape failed:", err instanceof Error ? err.message : err);
    notices.push("Luma scrape failed; community events skipped this run.");
    return { events: [], notices };
  }
}
