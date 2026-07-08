// Build the cheap-filter candidate pool from corpus + source-router hits (PR6).
import type { Event, NonprofitProfile } from "@/types";
import type { SourceCandidate } from "./sources";
import { identityKeyFor } from "./identity";
import { guessFromSnippet } from "./snippet-guess";

export function provisionalIdForKey(identityKey: string): string {
  return `provisional:${identityKey}`;
}

function baseEvent(partial: Partial<Event> & Pick<Event, "id" | "name" | "website">): Event {
  return {
    causeAreaTags: [],
    isSeed: false,
    isUniversal: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 0,
    sourceUrls: [partial.website],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function eventFromSourceCandidate(
  candidate: SourceCandidate,
  profile: NonprofitProfile,
): { event: Event; identityKey: string; organizerUrl?: string } {
  if (candidate.kind === "structured") {
    const identityKey = identityKeyFor({
      name: candidate.name,
      website: candidate.canonicalUrl,
      organizerUrl: candidate.organizerUrl,
      startDate: candidate.startDate,
      locationCity: candidate.locationCity,
    });
    return {
      identityKey,
      organizerUrl: candidate.organizerUrl,
      event: baseEvent({
        id: provisionalIdForKey(identityKey),
        name: candidate.name,
        website: candidate.canonicalUrl,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        locationCity: candidate.locationCity,
        locationState: candidate.locationState,
        locationCountry: candidate.locationCountry,
        format: candidate.format,
        causeAreaTags: candidate.causeAreaTags,
        lastScrapedAt: new Date().toISOString(),
        sourceUrls: [candidate.canonicalUrl],
      }),
    };
  }

  const guess = guessFromSnippet(
    candidate.title,
    candidate.snippet,
    profile.causeAreas,
    profile.geographyFocus,
  );
  const identityKey = identityKeyFor({
    name: candidate.title,
    website: candidate.url,
    startDate: undefined,
    locationCity: guess.locationCity,
  });
  return {
    identityKey,
    event: baseEvent({
      id: provisionalIdForKey(identityKey),
      name: candidate.title,
      website: candidate.url,
      locationCity: guess.locationCity,
      locationState: guess.locationState,
      locationCountry: guess.locationCountry,
      format: guess.format,
      causeAreaTags: guess.causeAreaTags,
      sourceUrls: [candidate.url],
    }),
  };
}

export function buildCandidatePool(
  corpus: Event[],
  sourced: SourceCandidate[],
  profile: NonprofitProfile,
): { events: Event[]; organizerUrls: Record<string, string> } {
  const byIdentity = new Map<string, Event>();
  for (const row of corpus) {
    byIdentity.set(
      identityKeyFor({
        name: row.name,
        website: row.website,
        startDate: row.startDate,
        locationCity: row.locationCity,
      }),
      row,
    );
  }

  const organizerUrls: Record<string, string> = {};
  for (const candidate of sourced) {
    const { event, identityKey, organizerUrl } = eventFromSourceCandidate(candidate, profile);
    if (organizerUrl) organizerUrls[event.website] = organizerUrl;
    if (!byIdentity.has(identityKey)) {
      byIdentity.set(identityKey, event);
    }
  }

  return { events: [...byIdentity.values()], organizerUrls };
}
