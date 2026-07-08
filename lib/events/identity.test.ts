// PR5 / ADR-0006: event identity keys merge the same real conference across
// seed rows, structured API listings, and crawler hits into one corpus row.
import { describe, expect, it } from "vitest";
import { identityKeyFor } from "./identity";

describe("identityKeyFor", () => {
  it("gives the same key for the same conference arriving from seed, Eventbrite, and Tavily", () => {
    const seed = identityKeyFor({
      name: "FreedomFest",
      website: "https://www.freedomfest.com/",
      startDate: "2026-07-08",
      locationCity: "Las Vegas",
    });
    const eventbrite = identityKeyFor({
      name: "FreedomFest 2026",
      website: "https://www.eventbrite.com/e/freedomfest-123",
      organizerUrl: "https://freedomfest.com",
      startDate: "2026-07-08",
      locationCity: "Las Vegas",
    });
    const tavily = identityKeyFor({
      name: "FreedomFest Registration",
      website: "https://freedomfest.com/register",
      startDate: "2026-07-08",
      locationCity: "Las Vegas",
    });

    expect(seed).toBe("org:freedomfest.com:2026");
    expect(eventbrite).toBe(seed);
    expect(tavily).toBe(seed);
  });

  it("keeps two similarly-named events in different cities on separate keys", () => {
    const denver = identityKeyFor({
      name: "National Housing Forum",
      website: "https://www.eventbrite.com/e/housing-forum-denver",
      startDate: "2026-09-12",
      locationCity: "Denver",
    });
    const boston = identityKeyFor({
      name: "National Housing Forum",
      website: "https://www.eventbrite.com/e/housing-forum-boston",
      startDate: "2026-09-12",
      locationCity: "Boston",
    });

    expect(denver).not.toBe(boston);
    expect(denver).toContain("denver");
    expect(boston).toContain("boston");
  });
});
