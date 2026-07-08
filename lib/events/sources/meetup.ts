// Meetup structured adapter (ADR-0002). Best-effort on the free GraphQL API —
// auth failures and rate limits degrade to notices, never a thrown run.
import { meetupDiscover } from "@/lib/data/meetup";
import type { CostMeter } from "@/lib/ai/cost";
import type { CommunityEvent } from "@/lib/data/community";
import type { NonprofitProfile } from "@/types";
import {
  MEETUP_MAX_TERMS_PER_RUN,
  type SourceAdapter,
  type SourceFetchOutcome,
  type StructuredSourceCandidate,
} from "./types";

/** Meetup searches by cause keyword, not the Tavily-style planned queries. */
function meetupTerms(profile: NonprofitProfile, queries: string[]): string[] {
  const causes = profile.causeAreas.filter((c) => c !== "other");
  const base = causes.length > 0 ? causes : queries;
  return base.slice(0, MEETUP_MAX_TERMS_PER_RUN);
}

function toCandidate(ce: CommunityEvent, causeTags: string[], query: string): StructuredSourceCandidate {
  return {
    kind: "structured",
    sourceId: "meetup",
    canonicalUrl: ce.sourceUrl,
    name: ce.name,
    startDate: ce.startDate,
    locationCity: ce.locationCity,
    locationState: ce.locationState,
    locationCountry: ce.locationCountry,
    format: ce.format,
    causeAreaTags: causeTags,
    query,
  };
}

export const meetupAdapter: SourceAdapter = {
  id: "meetup",
  kind: "structured",

  async fetch(
    profile: NonprofitProfile,
    queries: string[],
    meter: CostMeter,
  ): Promise<SourceFetchOutcome> {
    const terms = meetupTerms(profile, queries);
    const causeTags = profile.causeAreas.filter((c) => c !== "other");

    if (terms.length === 0) {
      meter.meetup({ stage: "event_search", calls: 0, latencyMs: 0 });
      return { candidates: [], notices: [] };
    }

    const profileCauses = profile.causeAreas.filter((c) => c !== "other");
    const stoppedAtBudget =
      (profileCauses.length > MEETUP_MAX_TERMS_PER_RUN && profileCauses.length > 0) ||
      (profileCauses.length === 0 && queries.length > MEETUP_MAX_TERMS_PER_RUN);

    const { events, notices } = await meetupDiscover(meter, terms);
    const candidates = events.map((ce, i) => toCandidate(ce, causeTags, terms[i] ?? terms[0] ?? ""));

    return { candidates, notices, stoppedAtBudget: stoppedAtBudget || undefined };
  },
};
