// Community-event discovery orchestration (Meetup API + Luma scrape). Both data
// adapters no-op cleanly when unconfigured, so this always returns safely. The
// discovered events are mapped into the same ScrapedEvent shape the Firecrawl
// path produces, so they flow through the identical dedupe → citation-validate
// → persist pipeline and compound into the shared corpus (the moat). Each
// event's own public URL is its source_url — citation or no signal.
import { CostMeter } from "@/lib/ai/cost";
import { meetupDiscover } from "@/lib/data/meetup";
import { lumaDiscover } from "@/lib/data/luma";
import type { CommunityEvent } from "@/lib/data/community";
import type { NonprofitProfile } from "@/types";
import type { ScrapedEvent, ScrapedEventData } from "./scrape";

/** Search terms for community sources: the profile's cause areas (minus the
 *  catch-all "other"). Empty ⇒ nothing to search, so discovery is skipped. */
function communitySearchTerms(profile: NonprofitProfile): string[] {
  return profile.causeAreas.filter((c) => c !== "other");
}

/** Map a community listing into a ScrapedEvent. causeAreaTags are set to the
 *  profile's cause areas it was discovered under — a classification (like a
 *  seed row's tags), NOT a cited fact, so it does not touch the citation rule;
 *  it lets the event clear the rules cause-overlap filter. Enrichment arrays
 *  stay empty until/unless the event is later deep-scraped. */
function toScrapedEvent(ce: CommunityEvent, causeTags: string[], scrapedAt: string): ScrapedEvent {
  const data: ScrapedEventData = {
    isEvent: true,
    name: ce.name,
    startDate: ce.startDate ?? null,
    endDate: null,
    locationCity: ce.locationCity ?? null,
    locationState: ce.locationState ?? null,
    locationCountry: ce.locationCountry ?? null,
    format: ce.format ?? null,
    causeAreaTags: causeTags,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
  };
  return { sourceUrl: ce.sourceUrl, scrapedAt, data };
}

export interface CommunityEventsOutcome {
  events: ScrapedEvent[];
  notices: string[];
}

export async function discoverCommunityEvents(
  meter: CostMeter,
  profile: NonprofitProfile,
): Promise<CommunityEventsOutcome> {
  const terms = communitySearchTerms(profile);
  if (terms.length === 0) return { events: [], notices: [] };

  const [meetup, luma] = await Promise.all([
    meetupDiscover(meter, terms),
    lumaDiscover(meter),
  ]);

  const scrapedAt = new Date().toISOString();
  const byUrl = new Map<string, ScrapedEvent>();
  for (const ce of [...meetup.events, ...luma.events]) {
    if (!byUrl.has(ce.sourceUrl)) byUrl.set(ce.sourceUrl, toScrapedEvent(ce, terms, scrapedAt));
  }

  return { events: [...byUrl.values()], notices: [...meetup.notices, ...luma.notices] };
}
