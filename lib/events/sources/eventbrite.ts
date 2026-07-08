// Eventbrite structured adapter (ADR-0002). Best-effort: the public search
// endpoint is largely retired, so a 404 degrades to a notice — never a thrown
// run. Low-level HTTP lives in lib/data/eventbrite.ts (shared with the legacy
// ideas pipeline until that path is retired).
import { eventbriteSearch, type EventbriteEvent } from "@/lib/data/eventbrite";
import type { CostMeter } from "@/lib/ai/cost";
import type { NonprofitProfile } from "@/types";
import { guessFromSnippet } from "@/lib/events/snippet-guess";
import {
  EVENTBRITE_MAX_QUERIES_PER_RUN,
  type SourceAdapter,
  type SourceFetchOutcome,
  type StructuredSourceCandidate,
} from "./types";

function toCandidate(
  ev: EventbriteEvent,
  query: string,
): StructuredSourceCandidate | null {
  if (!ev.url) return null;
  const guess = guessFromSnippet(ev.name, ev.description ?? "" + " " + query);
  return {
    kind: "structured",
    sourceId: "eventbrite",
    canonicalUrl: ev.url,
    name: ev.name,
    startDate: ev.startUtc ? ev.startUtc.slice(0, 10) : undefined,
    endDate: ev.endUtc ? ev.endUtc.slice(0, 10) : undefined,
    locationCity: ev.venueCity,
    locationState: ev.venueState,
    locationCountry: ev.venueCity || ev.venueState ? "USA" : undefined,
    causeAreaTags: guess.causeAreaTags,
    organizerUrl: ev.organizerUrl,
    description: ev.description || undefined,
    query: ev.query,
  };
}

function isEndpointUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("404") || /endpoint.*(retired|removed|unavailable)/i.test(msg);
}

export const eventbriteAdapter: SourceAdapter = {
  id: "eventbrite",
  kind: "structured",

  async fetch(
    _profile: NonprofitProfile,
    queries: string[],
    meter: CostMeter,
  ): Promise<SourceFetchOutcome> {
    const notices: string[] = [];
    const candidates: StructuredSourceCandidate[] = [];

    if (!process.env.EVENTBRITE_API_KEY) {
      notices.push("Eventbrite not configured (EVENTBRITE_API_KEY); structured search skipped.");
      meter.eventbrite({ stage: "event_search", calls: 0, latencyMs: 0 });
      return { candidates, notices };
    }

    if (queries.length === 0) {
      meter.eventbrite({ stage: "event_search", calls: 0, latencyMs: 0 });
      return { candidates, notices };
    }

    const capped = queries.slice(0, EVENTBRITE_MAX_QUERIES_PER_RUN);
    const stoppedAtBudget = queries.length > EVENTBRITE_MAX_QUERIES_PER_RUN;
    const started = Date.now();
    let calls = 0;
    const byUrl = new Map<string, StructuredSourceCandidate>();

    for (const query of capped) {
      try {
        calls += 1;
        const { events } = await eventbriteSearch(query, 5);
        for (const ev of events) {
          const c = toCandidate(ev, query);
          if (c) byUrl.set(c.canonicalUrl.toLowerCase().replace(/\/$/, ""), c);
        }
      } catch (err) {
        if (isEndpointUnavailable(err)) {
          notices.push("Eventbrite search unavailable (API endpoint retired or restricted).");
          break;
        }
        const label = err instanceof Error ? err.message : String(err);
        console.warn(`[sources/eventbrite] search failed for "${query}":`, label);
        notices.push(`Eventbrite search failed for "${query}".`);
      }
    }

    meter.eventbrite({ stage: "event_search", calls, latencyMs: Date.now() - started });
    return { candidates: [...byUrl.values()], notices, stoppedAtBudget };
  },
};
