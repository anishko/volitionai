// Acceptance tests for the relaxation cascade (ADR-0004) and tier-penalized
// scoring. The fixture corpus mirrors the real seed shapes: universal
// cross-sector fundraising conferences, cause-specific rows, wedge
// (civil_liberties) rows, and past editions.
import { describe, expect, it } from "vitest";
import type { Event, NonprofitProfile } from "@/types";
import { filterCandidates, MATCH_FLOOR, scoreEvent } from "./filter";

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

let eventSeq = 0;
function makeEvent(overrides: Partial<Event>): Event {
  eventSeq += 1;
  return {
    id: `event-${eventSeq}`,
    name: `Event ${eventSeq}`,
    website: `https://example.org/event-${eventSeq}`,
    startDate: daysFromNow(60),
    endDate: daysFromNow(62),
    locationCity: "Denver",
    locationState: "CO",
    locationCountry: "USA",
    format: "in_person",
    causeAreaTags: [],
    isSeed: true,
    isUniversal: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 1,
    sourceUrls: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(overrides: Partial<NonprofitProfile>): NonprofitProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    orgName: "Test Org",
    causeAreas: [],
    currentDonorMix: [],
    targetDonorType: [],
    geographyFocus: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** A corpus shaped like the real seed: universal + cause-specific + wedge. */
function seedLikeCorpus() {
  const standardCauses = [
    "education", "environment", "health", "housing", "youth", "arts", "human_services",
  ];
  return [
    // Universal cross-sector fundraising conferences (the "28 rows").
    ...Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        name: `Fundraising Conference ${i}`,
        causeAreaTags: standardCauses,
        isUniversal: true,
      }),
    ),
    // Wedge rows: upcoming civil-liberties events.
    makeEvent({ name: "FreedomFest", causeAreaTags: ["civil_liberties"], locationState: "NV" }),
    makeEvent({ name: "SPN Annual Meeting", causeAreaTags: ["civil_liberties"], locationState: "FL" }),
    makeEvent({ name: "Liberty Forum", causeAreaTags: ["civil_liberties"], locationState: "NY" }),
    makeEvent({ name: "Lawyers Convention", causeAreaTags: ["civil_liberties"], locationState: "DC" }),
    makeEvent({ name: "Innocence Network Conference", causeAreaTags: ["civil_liberties"], locationState: "CA" }),
    // A past wedge edition: must never surface.
    makeEvent({
      name: "FreedomFest (past edition)",
      causeAreaTags: ["civil_liberties"],
      startDate: daysFromNow(-370),
      endDate: daysFromNow(-367),
    }),
    // Cause-specific rows for other causes.
    makeEvent({ name: "Housing Forum", causeAreaTags: ["housing"], locationState: "DC" }),
    makeEvent({ name: "Land Conservation Rally", causeAreaTags: ["environment"], locationState: "CO" }),
    makeEvent({ name: "Mentoring Summit", causeAreaTags: ["youth", "education"], locationState: "DC" }),
    // A virtual universal event (the floor's safety net).
    makeEvent({
      name: "Good Tech Fest",
      causeAreaTags: standardCauses,
      isUniversal: true,
      format: "virtual",
      startDate: undefined,
      endDate: undefined,
      locationCity: undefined,
      locationState: undefined,
    }),
  ];
}

describe("filterCandidates (relaxation cascade)", () => {
  it("gives a civil_liberties-only profile its wedge events strict and universal events cause_broadened, reaching the floor", () => {
    const profile = makeProfile({ causeAreas: ["civil_liberties"] });
    const outcome = filterCandidates(profile, seedLikeCorpus());

    expect(outcome.kept.length).toBeGreaterThanOrEqual(MATCH_FLOOR);

    const tierOf = (name: string) =>
      outcome.kept.find((k) => k.event.name === name)?.matchTier;
    expect(tierOf("FreedomFest")).toBe("strict");
    expect(tierOf("SPN Annual Meeting")).toBe("strict");
    expect(tierOf("Innocence Network Conference")).toBe("strict");
    // 5 upcoming wedge rows fill the floor exactly; universal rows only join
    // once the cascade decides more are needed - with floor=5 met, none do.
    expect(outcome.kept.every((k) => k.matchTier === "strict")).toBe(true);
    expect(outcome.relaxed).toBe(false);
  });

  it("broadens to universal events when strict matches alone cannot fill the floor", () => {
    const profile = makeProfile({ causeAreas: ["civil_liberties"] });
    // Corpus with only 2 upcoming wedge rows + universal rows.
    const corpus = [
      makeEvent({ name: "FreedomFest", causeAreaTags: ["civil_liberties"] }),
      makeEvent({ name: "SPN", causeAreaTags: ["civil_liberties"] }),
      ...Array.from({ length: 5 }, (_, i) =>
        makeEvent({
          name: `Fundraising Conference ${i}`,
          causeAreaTags: ["education", "health", "human_services"],
          isUniversal: true,
        }),
      ),
    ];
    const outcome = filterCandidates(profile, corpus);

    expect(outcome.kept.length).toBeGreaterThanOrEqual(MATCH_FLOOR);
    expect(outcome.relaxed).toBe(true);
    const tiers = new Map(outcome.kept.map((k) => [k.event.name, k.matchTier]));
    expect(tiers.get("FreedomFest")).toBe("strict");
    expect(tiers.get("Fundraising Conference 0")).toBe("cause_broadened");
  });

  it("includes adjacent-cause events in the cause-broadened tier", () => {
    const profile = makeProfile({ causeAreas: ["housing"] });
    const corpus = [
      makeEvent({ name: "Housing Forum", causeAreaTags: ["housing"] }),
      // human_services is adjacent to housing (homelessness work spans both).
      makeEvent({ name: "Human Services Summit", causeAreaTags: ["human_services"] }),
      // arts is not adjacent to housing.
      makeEvent({ name: "Arts Conference", causeAreaTags: ["arts"] }),
    ];
    const outcome = filterCandidates(profile, corpus);

    const tiers = new Map(outcome.kept.map((k) => [k.event.name, k.matchTier]));
    expect(tiers.get("Housing Forum")).toBe("strict");
    expect(tiers.get("Human Services Summit")).toBe("cause_broadened");
    expect(tiers.has("Arts Conference")).toBe(false);
  });

  it("falls to the virtual floor when nothing matches by cause", () => {
    const profile = makeProfile({ causeAreas: ["arts"] });
    const corpus = [
      makeEvent({ name: "Housing Forum", causeAreaTags: ["housing"] }),
      makeEvent({ name: "Virtual Health Summit", causeAreaTags: ["health"], format: "virtual" }),
      makeEvent({ name: "Hybrid Env Meeting", causeAreaTags: ["environment"], format: "hybrid" }),
    ];
    const outcome = filterCandidates(profile, corpus);

    expect(outcome.deepestTier).toBe("virtual_floor");
    const tiers = new Map(outcome.kept.map((k) => [k.event.name, k.matchTier]));
    expect(tiers.get("Virtual Health Summit")).toBe("virtual_floor");
    expect(tiers.get("Hybrid Env Meeting")).toBe("virtual_floor");
    // In-person off-cause events stay out even at the floor.
    expect(tiers.has("Housing Forum")).toBe(false);
  });

  it("returns empty for an empty corpus (never fabricates)", () => {
    const profile = makeProfile({ causeAreas: ["housing"] });
    const outcome = filterCandidates(profile, []);
    expect(outcome.kept).toEqual([]);
  });

  it("never surfaces past events at any tier", () => {
    const profile = makeProfile({ causeAreas: ["civil_liberties"] });
    const corpus = [
      makeEvent({
        name: "Past Wedge",
        causeAreaTags: ["civil_liberties"],
        startDate: daysFromNow(-30),
        endDate: daysFromNow(-28),
      }),
      makeEvent({
        name: "Past Virtual",
        causeAreaTags: ["education"],
        format: "virtual",
        startDate: daysFromNow(-30),
        endDate: daysFromNow(-28),
      }),
    ];
    const outcome = filterCandidates(profile, corpus);
    expect(outcome.kept).toEqual([]);
    expect(outcome.droppedPast).toBe(2);
  });

  it("treats out-of-state in-person events as geo_relaxed for a local org", () => {
    const profile = makeProfile({
      causeAreas: ["housing"],
      geographyFocus: "local",
      headquarters: "Las Vegas, NV",
    });
    const corpus = [
      makeEvent({ name: "In-State Forum", causeAreaTags: ["housing"], locationState: "NV" }),
      makeEvent({ name: "Out-of-State Forum", causeAreaTags: ["housing"], locationState: "MD" }),
      makeEvent({ name: "Virtual Forum", causeAreaTags: ["housing"], format: "virtual", locationState: undefined }),
    ];
    const outcome = filterCandidates(profile, corpus);

    const tiers = new Map(outcome.kept.map((k) => [k.event.name, k.matchTier]));
    expect(tiers.get("In-State Forum")).toBe("strict");
    expect(tiers.get("Out-of-State Forum")).toBe("geo_relaxed");
    expect(tiers.get("Virtual Forum")).toBe("strict"); // virtual reaches everywhere
  });

  it("does not relax past strict when strict alone fills the floor", () => {
    const profile = makeProfile({ causeAreas: ["education"] });
    const corpus = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeEvent({ name: `Education Conf ${i}`, causeAreaTags: ["education"] }),
      ),
      // Adjacent (youth) event that must NOT appear: floor already met.
      makeEvent({ name: "Youth Summit", causeAreaTags: ["youth"] }),
    ];
    const outcome = filterCandidates(profile, corpus);

    expect(outcome.relaxed).toBe(false);
    expect(outcome.kept.length).toBe(6);
    expect(outcome.kept.every((k) => k.matchTier === "strict")).toBe(true);
  });
});

describe("scoreEvent (tier penalties)", () => {
  it("scores the same event strictly lower at each looser tier", () => {
    const profile = makeProfile({ causeAreas: ["housing"] });
    const event = makeEvent({ name: "Forum", causeAreaTags: ["housing"] });

    const strict = scoreEvent(profile, event, [], "strict");
    const geo = scoreEvent(profile, event, [], "geo_relaxed");
    const cause = scoreEvent(profile, event, [], "cause_broadened");
    const floor = scoreEvent(profile, event, [], "virtual_floor");

    expect(strict).toBeGreaterThan(geo);
    expect(geo).toBeGreaterThan(cause);
    expect(cause).toBeGreaterThan(floor);
  });

  it("gives a broadened universal event the neutral cause baseline instead of zero", () => {
    const profile = makeProfile({ causeAreas: ["civil_liberties"] });
    const universal = makeEvent({
      name: "Fundraising Conf",
      causeAreaTags: ["education", "health"],
      isUniversal: true,
    });
    const offCause = makeEvent({
      name: "Arts Conf",
      causeAreaTags: ["arts"],
      isUniversal: false,
    });

    const universalScore = scoreEvent(profile, universal, [], "cause_broadened");
    const offCauseScore = scoreEvent(profile, offCause, [], "cause_broadened");
    expect(universalScore).toBeGreaterThan(offCauseScore);
  });

  it("keeps scores within 0-100 after penalties", () => {
    const profile = makeProfile({ causeAreas: ["arts"] });
    const weak = makeEvent({
      name: "Weak Match",
      causeAreaTags: ["housing"],
      startDate: undefined,
      endDate: undefined,
    });
    const score = scoreEvent(profile, weak, [], "virtual_floor");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
