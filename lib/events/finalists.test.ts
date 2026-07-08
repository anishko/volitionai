import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import { countSkippedFreshStructured, finalistsToScrape } from "./finalists";

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: "e1",
    name: "Forum",
    website: "https://example.org/forum",
    causeAreaTags: ["housing"],
    isSeed: true,
    isUniversal: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 1,
    sourceUrls: ["https://example.org/forum"],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("finalistsToScrape", () => {
  it("spends Firecrawl budget only on finalists that need a scrape", () => {
    const now = new Date("2026-07-08T12:00:00Z");
    const finalists = [
      event({
        name: "Fresh API listing",
        website: "https://eventbrite.com/e/1",
        lastScrapedAt: "2026-07-07T00:00:00.000Z",
      }),
      event({
        name: "Stale listing",
        website: "https://example.org/stale",
        lastScrapedAt: "2026-05-01T00:00:00.000Z",
      }),
      event({ name: "Never scraped", website: "https://example.org/new" }),
    ];

    const targets = finalistsToScrape(finalists, 5, now);
    expect(targets.map((t) => t.url)).toEqual([
      "https://example.org/stale",
      "https://example.org/new",
    ]);
    expect(countSkippedFreshStructured(finalists, now)).toBe(1);
  });
});
