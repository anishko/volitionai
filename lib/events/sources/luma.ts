// Luma structured adapter — Firecrawl scrape of a public discovery page.
import { lumaDiscover } from "@/lib/data/luma";
import type { CostMeter } from "@/lib/ai/cost";
import type { CommunityEvent } from "@/lib/data/community";
import type { NonprofitProfile } from "@/types";
import type { SourceAdapter, SourceFetchOutcome, StructuredSourceCandidate } from "./types";

function toCandidate(ce: CommunityEvent, causeTags: string[]): StructuredSourceCandidate {
  return {
    kind: "structured",
    sourceId: "luma",
    canonicalUrl: ce.sourceUrl,
    name: ce.name,
    startDate: ce.startDate,
    locationCity: ce.locationCity,
    locationState: ce.locationState,
    locationCountry: ce.locationCountry,
    format: ce.format,
    causeAreaTags: causeTags,
    query: "luma-discovery",
  };
}

export const lumaAdapter: SourceAdapter = {
  id: "luma",
  kind: "structured",

  async fetch(profile: NonprofitProfile, _queries: string[], meter: CostMeter): Promise<SourceFetchOutcome> {
    const causeTags = profile.causeAreas.filter((c) => c !== "other");
    const { events, notices } = await lumaDiscover(meter);
    return {
      candidates: events.map((ce) => toCandidate(ce, causeTags)),
      notices,
    };
  },
};
