// PR5 merge rules: richest field wins and every contributing source URL is kept
// so a card can cite all of them (ADR-0006).
import { describe, expect, it } from "vitest";
import { appendSourceUrl, mergeDiscoveredPayload, type CorpusSnapshot } from "./merge-fields";

describe("appendSourceUrl", () => {
  it("appends a new normalized URL without duplicates", () => {
    expect(appendSourceUrl(["https://a.org/x"], "https://a.org/x/")).toEqual(["https://a.org/x"]);
    expect(appendSourceUrl(["https://a.org/x"], "https://b.org/y")).toEqual([
      "https://a.org/x",
      "https://b.org/y",
    ]);
  });
});

describe("mergeDiscoveredPayload", () => {
  it("merges three source URLs into one row with richest scalar fields", () => {
    const existing: CorpusSnapshot = {
      id: "seed-1",
      identityKey: "org:freedomfest.com:2026",
      name: "FreedomFest",
      website: "https://www.freedomfest.com/",
      sourceUrls: ["https://www.freedomfest.com/"],
      startDate: "2026-07-08",
      endDate: undefined,
      locationCity: "Las Vegas",
      locationState: "NV",
      locationCountry: "USA",
      format: "in_person",
      causeAreaTags: ["civil_liberties"],
      isSeed: true,
      scrapeCount: 1,
      speakers: [],
      sponsors: [],
      organizerContacts: [],
      participationTiers: [],
      lastScrapedAt: undefined,
    };

    const afterEventbrite = mergeDiscoveredPayload(existing, {
      identityKey: "org:freedomfest.com:2026",
      name: "FreedomFest 2026 — Official Tickets",
      website: "https://www.eventbrite.com/e/freedomfest-123",
      sourceUrl: "https://www.eventbrite.com/e/freedomfest-123",
      startDate: "2026-07-08",
      endDate: "2026-07-10",
      locationCity: "Las Vegas",
      locationState: "NV",
      locationCountry: "USA",
      format: "in_person",
      causeAreaTags: ["civil_liberties"],
      speakers: [{ name: "Keynote Speaker", sourceUrl: "https://www.eventbrite.com/e/freedomfest-123" }],
      sponsors: [],
      organizerContacts: [],
      participationTiers: [],
      scrapedAt: "2026-07-01T00:00:00.000Z",
      isSeed: false,
    });

    const merged = mergeDiscoveredPayload(afterEventbrite, {
      identityKey: "org:freedomfest.com:2026",
      name: "FreedomFest Registration",
      website: "https://freedomfest.com/register",
      sourceUrl: "https://freedomfest.com/register",
      startDate: "2026-07-08",
      locationCity: "Las Vegas",
      causeAreaTags: ["civil_liberties"],
      speakers: [],
      sponsors: [{ name: "Gold Sponsor", sourceUrl: "https://freedomfest.com/register" }],
      organizerContacts: [],
      participationTiers: [],
      scrapedAt: "2026-07-02T00:00:00.000Z",
      isSeed: false,
    });

    expect(merged.sourceUrls).toHaveLength(3);
    expect(merged.sourceUrls).toEqual(
      expect.arrayContaining([
        "https://www.freedomfest.com/",
        "https://www.eventbrite.com/e/freedomfest-123",
        "https://freedomfest.com/register",
      ]),
    );
    expect(merged.endDate).toBe("2026-07-10");
    expect(merged.speakers).toHaveLength(1);
    expect(merged.sponsors).toHaveLength(1);
    expect(merged.isSeed).toBe(true);
  });
});
