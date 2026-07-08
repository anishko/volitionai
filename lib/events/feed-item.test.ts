import { describe, expect, it } from "vitest";
import { registrationUrgency, sortEventFeedItems } from "./feed-item";
import type { Event, EventMatch } from "@/types";

// ── minimal factories ────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "evt-1",
    name: "Test Conference",
    website: "https://example.com",
    causeAreaTags: [],
    isSeed: false,
    isUniversal: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 1,
    sourceUrls: [],
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMatch(event: Event, matchScore: number, overrides: Partial<EventMatch> = {}): EventMatch & { event: Event } {
  return {
    id: "match-1",
    profileId: "profile-1",
    eventId: event.id,
    matchScore,
    whyAttend: "Great event",
    evidence: [],
    status: "recommended",
    matchTier: "strict",
    createdAt: "2025-01-01T00:00:00Z",
    event,
    ...overrides,
  };
}

function tier(deadline: string) {
  return { tier: "attendee", sourceUrl: "https://example.com", verifiedAt: "2025-01-01T00:00:00Z", deadline };
}

// Fixed reference date: 2025-06-15
const REF = new Date("2025-06-15T12:00:00Z");

// ── registrationUrgency ──────────────────────────────────────────────────────

describe("registrationUrgency", () => {
  it("returns undefined when event has no participation tiers", () => {
    const event = makeEvent({ participationTiers: [] });
    expect(registrationUrgency(event, REF)).toBeUndefined();
  });

  it("returns undefined when the only deadline is in the past", () => {
    const event = makeEvent({ participationTiers: [tier("2025-06-14")] });
    expect(registrationUrgency(event, REF)).toBeUndefined();
  });

  it("returns undefined when the deadline is more than 30 days away", () => {
    const event = makeEvent({ participationTiers: [tier("2025-07-16")] }); // 31 days
    expect(registrationUrgency(event, REF)).toBeUndefined();
  });

  it("returns urgency object when deadline is within the 30-day window", () => {
    const event = makeEvent({ participationTiers: [tier("2025-06-30")] }); // 15 days
    const result = registrationUrgency(event, REF);
    expect(result).toBeDefined();
    expect(result?.deadline).toBe("2025-06-30");
    expect(result?.daysUntilDeadline).toBe(15);
  });

  it("returns 'closes today' label when deadline is today", () => {
    const event = makeEvent({ participationTiers: [tier("2025-06-15")] }); // 0 days
    const result = registrationUrgency(event, REF);
    expect(result?.label).toBe("Registration closes today");
  });

  it("returns 'closes tomorrow' label when deadline is 1 day away", () => {
    const event = makeEvent({ participationTiers: [tier("2025-06-16")] }); // 1 day
    const result = registrationUrgency(event, REF);
    expect(result?.label).toBe("Registration closes tomorrow");
  });

  it("returns 'closes in N days' label for dates further away", () => {
    const event = makeEvent({ participationTiers: [tier("2025-06-25")] }); // 10 days
    const result = registrationUrgency(event, REF);
    expect(result?.label).toBe("Registration closes in 10 days");
  });

  it("picks the nearest upcoming deadline when multiple tiers are present", () => {
    const event = makeEvent({
      participationTiers: [
        tier("2025-07-01"), // 16 days
        tier("2025-06-20"), // 5 days — nearest
        tier("2025-06-14"), // past — excluded
      ],
    });
    const result = registrationUrgency(event, REF);
    expect(result?.deadline).toBe("2025-06-20");
    expect(result?.daysUntilDeadline).toBe(5);
  });
});

// ── sortEventFeedItems ───────────────────────────────────────────────────────

describe("sortEventFeedItems", () => {
  it("sorts items by match score descending", () => {
    const evtA = makeEvent({ id: "a", name: "Alpha" });
    const evtB = makeEvent({ id: "b", name: "Beta" });
    const items = [makeMatch(evtA, 60), makeMatch(evtB, 80, { id: "match-2" })];
    const sorted = sortEventFeedItems(items, REF);
    expect(sorted[0].matchScore).toBe(80);
    expect(sorted[1].matchScore).toBe(60);
  });

  it("urgency bump lifts a lower-score item above a higher-score one", () => {
    // evtA: score 80, no urgency → effective 80
    // evtB: score 77, deadline in 5 days → effective 77 + 5 = 82
    const evtA = makeEvent({ id: "a", name: "Alpha" });
    const evtB = makeEvent({
      id: "b",
      name: "Beta",
      participationTiers: [tier("2025-06-20")], // 5 days from REF
    });
    const items = [makeMatch(evtA, 80), makeMatch(evtB, 77, { id: "match-2" })];
    const sorted = sortEventFeedItems(items, REF);
    expect(sorted[0].event.id).toBe("b"); // bumped to top
    expect(sorted[1].event.id).toBe("a");
  });

  it("when effective scores tie, the item with the nearest deadline ranks first", () => {
    // Both get +5 bump, same base score — nearest deadline wins
    const evtA = makeEvent({
      id: "a",
      name: "Alpha",
      participationTiers: [tier("2025-06-25")], // 10 days
    });
    const evtB = makeEvent({
      id: "b",
      name: "Beta",
      participationTiers: [tier("2025-06-18")], // 3 days — nearer
    });
    const items = [makeMatch(evtA, 75), makeMatch(evtB, 75, { id: "match-2" })];
    const sorted = sortEventFeedItems(items, REF);
    expect(sorted[0].event.id).toBe("b");
    expect(sorted[1].event.id).toBe("a");
  });
});
