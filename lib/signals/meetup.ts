// STAGE: community-event discovery — Meetup adapter + community orchestrator.
// PRD v4 (amendment #3) defines these adapters. Meetup uses the official API and
// is FREE, so it is metered at {credits: 0, usd: 0} (honest per-stage accounting)
// with HTTP 429 rate-limit handling. Every event carries its eventUrl as
// source_url (citation or no signal). Luma discovery is delegated to
// lib/signals/luma.ts (Firecrawl scrape of public pages, robots-respecting).
// Both feed the same events corpus under the same field-level citation rule.
import { CostMeter } from "@/lib/ai/cost";
import { isBudgetSensitive } from "./tavily-events";
import { lumaDiscover } from "./luma";
import type { EventWithRoi, NonprofitProfileForMatch } from "@/types";

const MEETUP_GQL = "https://api.meetup.com/gql";

export function meetupConfigured(): boolean {
  return Boolean(process.env.MEETUP_ACCESS_TOKEN);
}

/** Search terms derived from the profile — sub-tags first, then cause areas. */
function searchTerms(p: NonprofitProfileForMatch): string[] {
  const terms = p.causeSubTags.length ? p.causeSubTags : p.causeAreas;
  return terms.slice(0, 3);
}

interface MeetupEventNode {
  id: string;
  title?: string;
  eventUrl?: string;
  dateTime?: string;
  eventType?: string; // PHYSICAL | ONLINE | HYBRID
  venue?: { city?: string; state?: string; country?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Meetup keyword search. Handles HTTP 429 by honoring Retry-After (bounded)
 *  and retrying once; other non-OK statuses throw. */
async function meetupSearch(term: string, timeoutMs = 10_000): Promise<MeetupEventNode[]> {
  const query = `query($q:String!){ keywordSearch(input:{first:5}, filter:{query:$q, source:EVENTS}){ edges{ node{ result{ ... on Event { id title eventUrl dateTime eventType venue{ city state country } } } } } } }`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(MEETUP_GQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MEETUP_ACCESS_TOKEN}`,
        },
        signal: controller.signal,
        body: JSON.stringify({ query, variables: { q: term } }),
      });

      if (res.status === 429 && attempt === 0) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Math.min((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000, 5000);
        await sleep(waitMs);
        continue; // one retry
      }
      if (!res.ok) throw new Error(`Meetup ${res.status}`);

      const data = await res.json();
      const edges = data?.data?.keywordSearch?.edges ?? [];
      return edges
        .map((e: { node?: { result?: MeetupEventNode } }) => e?.node?.result)
        .filter((r: MeetupEventNode | undefined): r is MeetupEventNode => Boolean(r?.id));
    } finally {
      clearTimeout(timer);
    }
  }
  return []; // exhausted the single retry on 429
}

function meetupTypeToFormat(t?: string): EventWithRoi["format"] {
  if (t === "ONLINE") return "virtual";
  if (t === "HYBRID") return "hybrid";
  if (t === "PHYSICAL") return "in_person";
  return undefined;
}

function meetupToEvent(n: MeetupEventNode): EventWithRoi | null {
  const url = n.eventUrl;
  if (!url) return null; // no source_url → no candidate
  const now = new Date().toISOString();
  return {
    id: `meetup_${n.id}`,
    name: n.title ?? "Meetup event",
    website: url,
    startDate: n.dateTime ? n.dateTime.slice(0, 10) : undefined,
    locationCity: n.venue?.city,
    locationState: n.venue?.state,
    locationCountry: n.venue?.country,
    format: meetupTypeToFormat(n.eventType),
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
  };
}

export interface MeetupDiscoveryResult {
  results: EventWithRoi[];
  credits: 0; // official API is free
  usd: 0;
  degraded: string[];
}

/** Meetup adapter — the official-API metered discovery. Returns a
 *  {results, credits: 0, usd: 0} shape; no-ops (with a notice) when unconfigured. */
export async function meetupDiscover(
  meter: CostMeter,
  profile: NonprofitProfileForMatch,
): Promise<MeetupDiscoveryResult> {
  const degraded: string[] = [];
  if (!meetupConfigured()) {
    degraded.push("Meetup unconfigured (MEETUP_ACCESS_TOKEN) — community-event discovery skipped");
    return { results: [], credits: 0, usd: 0, degraded };
  }

  const started = Date.now();
  const byUrl = new Map<string, EventWithRoi>();
  let calls = 0;
  for (const term of searchTerms(profile)) {
    try {
      calls += 1;
      for (const node of await meetupSearch(term)) {
        const ev = meetupToEvent(node);
        if (ev) byUrl.set(ev.website, ev);
      }
    } catch (err) {
      console.warn(`[meetup] search failed for "${term}":`, err instanceof Error ? err.message : err);
      degraded.push(`Meetup search failed for "${term}"`);
    }
  }
  if (calls > 0) {
    meter.free({ stage: "event_search", provider: "meetup", unitCount: calls, latencyMs: Date.now() - started });
  }
  return { results: [...byUrl.values()], credits: 0, usd: 0, degraded };
}

export interface CommunityDiscoveryResult {
  events: EventWithRoi[];
  degraded: string[];
}

/** Discover public community events via Meetup (API) + Luma (Firecrawl scrape).
 *  Both no-op cleanly when unconfigured; the pipeline continues on other sources. */
export async function discoverCommunityEvents(
  meter: CostMeter,
  profile: NonprofitProfileForMatch,
): Promise<CommunityDiscoveryResult> {
  const [meetup, luma] = await Promise.all([
    meetupDiscover(meter, profile),
    lumaDiscover(meter, profile),
  ]);

  const events = [...meetup.results, ...luma.results];
  const degraded = [...meetup.degraded, ...luma.degraded];

  // Budget-sensitive orgs value virtual events; note when we could not augment
  // the corpus with community sources that skew virtual.
  if (isBudgetSensitive(profile) && events.length === 0 && degraded.length > 0) {
    degraded.push(
      "No community (Meetup/Luma) virtual events added — budget-sensitive profile relies on seed + web corpus",
    );
  }

  return { events, degraded };
}
