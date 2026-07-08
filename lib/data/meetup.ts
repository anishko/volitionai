// Community-event discovery — Meetup adapter (PRD v4, amendment #3). Uses the
// official Meetup GraphQL API, which is FREE, so it is metered at usd 0 (honest
// per-stage accounting) with HTTP 429 rate-limit handling. Every event carries
// its eventUrl as source_url (citation or no signal). No-ops cleanly (with a
// notice) when MEETUP_ACCESS_TOKEN is unset — degradation, not a mock.
import { CostMeter } from "@/lib/ai/cost";
import type { CommunityEvent } from "./community";

const MEETUP_GQL = "https://api.meetup.com/gql";

export function meetupConfigured(): boolean {
  return Boolean(process.env.MEETUP_ACCESS_TOKEN);
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

function meetupTypeToFormat(t?: string): CommunityEvent["format"] {
  if (t === "ONLINE") return "virtual";
  if (t === "HYBRID") return "hybrid";
  if (t === "PHYSICAL") return "in_person";
  return undefined;
}

/** One Meetup keyword search. Honors HTTP 429 Retry-After (bounded) and retries
 *  once; other non-OK statuses throw. */
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
        const waitMs = Math.min((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000, 5_000);
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
  return []; // exhausted the single 429 retry
}

function meetupToCommunityEvent(n: MeetupEventNode): CommunityEvent | null {
  if (!n.eventUrl) return null; // no source_url → no candidate
  return {
    source: "meetup",
    name: n.title?.trim() || "Meetup event",
    sourceUrl: n.eventUrl,
    startDate: n.dateTime ? n.dateTime.slice(0, 10) : undefined,
    locationCity: n.venue?.city,
    locationState: n.venue?.state,
    locationCountry: n.venue?.country,
    format: meetupTypeToFormat(n.eventType),
  };
}

export interface CommunityDiscoveryOutcome {
  events: CommunityEvent[];
  notices: string[];
}

/** Search Meetup for the given terms (derived from the profile upstream).
 *  Metered even though free; degrades to a notice when unconfigured. */
export async function meetupDiscover(
  meter: CostMeter,
  terms: string[],
): Promise<CommunityDiscoveryOutcome> {
  const notices: string[] = [];
  if (!meetupConfigured()) {
    notices.push("Meetup not configured (MEETUP_ACCESS_TOKEN); community events skipped.");
    return { events: [], notices };
  }

  const started = Date.now();
  const byUrl = new Map<string, CommunityEvent>();
  let calls = 0;
  for (const term of terms.slice(0, 3)) {
    try {
      calls += 1;
      for (const node of await meetupSearch(term)) {
        const ev = meetupToCommunityEvent(node);
        if (ev) byUrl.set(ev.sourceUrl, ev);
      }
    } catch (err) {
      console.warn(`[meetup] search failed for "${term}":`, err instanceof Error ? err.message : err);
      notices.push(`Meetup search failed for "${term}".`);
    }
  }
  if (calls > 0) {
    meter.meetup({ stage: "event_search", calls, latencyMs: Date.now() - started });
  }
  return { events: [...byUrl.values()], notices };
}
