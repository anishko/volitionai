import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import { filterCandidates } from "./filter";
import { scoreEvent } from "./filter";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("post-scrape re-score", () => {
  it("demotes a finalist whose verified dates turn out past", () => {
    const profile = {
      id: "p1",
      userId: "u1",
      orgName: "Org",
      causeAreas: ["housing"],
      currentDonorMix: [],
      targetDonorType: [],
      geographyFocus: "national" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const upcomingGuess: Event = {
      id: "provisional:1",
      name: "Housing Forum",
      website: "https://example.org/forum",
      startDate: daysFromNow(90),
      causeAreaTags: ["housing"],
      isSeed: false,
      isUniversal: false,
      speakers: [],
      sponsors: [],
      organizerContacts: [],
      participationTiers: [],
      donorSignals: [],
      timingSignals: [],
      scrapeCount: 0,
      sourceUrls: ["https://example.org/forum"],
      createdAt: new Date().toISOString(),
    };

    const pastVerified: Event = {
      ...upcomingGuess,
      id: "db-1",
      startDate: daysFromNow(-30),
      endDate: daysFromNow(-28),
      scrapeCount: 1,
      lastScrapedAt: new Date().toISOString(),
    };

    const before = filterCandidates(profile, [upcomingGuess]).kept;
    const after = filterCandidates(profile, [pastVerified]).kept;

    expect(before.length).toBeGreaterThan(0);
    expect(after).toHaveLength(0);

    const beforeScore = scoreEvent(profile, upcomingGuess, [], "strict");
    const afterScore = scoreEvent(profile, pastVerified, [], "strict");
    expect(beforeScore).toBeGreaterThan(afterScore);
  });
});
