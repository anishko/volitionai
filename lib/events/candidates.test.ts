import { describe, expect, it } from "vitest";
import type { NonprofitProfile } from "@/types";
import { buildCandidatePool } from "./candidates";

function profile(): NonprofitProfile {
  return {
    id: "p1",
    userId: "u1",
    orgName: "Test",
    causeAreas: ["housing"],
    currentDonorMix: [],
    targetDonorType: [],
    geographyFocus: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("buildCandidatePool", () => {
  it("lets a structured API candidate join the pool without a scrape", () => {
    const { events } = buildCandidatePool([], [
      {
        kind: "structured",
        sourceId: "eventbrite",
        canonicalUrl: "https://www.eventbrite.com/e/housing-forum",
        name: "Housing Forum 2026",
        startDate: "2026-10-01",
        locationCity: "Denver",
        locationState: "CO",
        causeAreaTags: ["housing"],
        query: "housing forum",
      },
    ], profile());

    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("Housing Forum 2026");
    expect(events[0]?.lastScrapedAt).toBeTruthy();
  });

  it("adds provisional cause tags to crawler candidates from the snippet", () => {
    const { events } = buildCandidatePool([], [
      {
        kind: "crawler",
        sourceId: "tavily",
        url: "https://example.org/housing-forum-denver",
        title: "Denver Housing Forum 2026",
        snippet: "Annual housing convening in Denver, CO for nonprofit leaders.",
        query: "housing forum denver",
      },
    ], profile());

    expect(events[0]?.causeAreaTags).toContain("housing");
    expect(events[0]?.locationState).toBe("CO");
    expect(events[0]?.lastScrapedAt).toBeUndefined();
  });
});
