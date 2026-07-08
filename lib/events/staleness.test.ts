import { describe, expect, it } from "vitest";
import type { Event } from "@/types";
import { eventNeedsScrape } from "./staleness";

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: "e1",
    name: "Forum",
    website: "https://example.org",
    causeAreaTags: ["housing"],
    isSeed: false,
    isUniversal: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 1,
    sourceUrls: ["https://example.org"],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("eventNeedsScrape", () => {
  it("requires scrape when never scraped", () => {
    expect(eventNeedsScrape(makeEvent({ lastScrapedAt: undefined }))).toBe(true);
  });

  it("skips fresh structured rows", () => {
    const now = new Date("2026-07-08T12:00:00Z");
    expect(
      eventNeedsScrape(
        makeEvent({ lastScrapedAt: "2026-07-01T00:00:00.000Z", startDate: "2026-09-01" }),
        now,
      ),
    ).toBe(false);
  });

  it("rescrapes when verified dates would be past after refresh", () => {
    const now = new Date("2026-08-01T12:00:00Z");
    expect(
      eventNeedsScrape(
        makeEvent({
          lastScrapedAt: "2026-06-01T00:00:00.000Z",
          startDate: "2026-06-15",
          endDate: "2026-06-16",
        }),
        now,
      ),
    ).toBe(true);
  });
});
