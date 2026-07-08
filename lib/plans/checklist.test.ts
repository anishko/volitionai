import { describe, expect, it } from "vitest";
import { buildChecklist, findEventTier, normalizeTier } from "./checklist";
import type { Event } from "@/types";

// ── minimal factory ──────────────────────────────────────────────────────────

function makeEvent(tiers: { tier: string; deadline?: string }[] = []): Event {
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
    participationTiers: tiers.map((t) => ({
      ...t,
      sourceUrl: "https://example.com/register",
      verifiedAt: "2025-01-01T00:00:00Z",
    })),
    donorSignals: [],
    timingSignals: [],
    scrapeCount: 1,
    sourceUrls: [],
    createdAt: "2025-01-01T00:00:00Z",
  };
}

// ── normalizeTier ────────────────────────────────────────────────────────────

describe("normalizeTier", () => {
  it("maps 'cfp' to speaking", () => {
    expect(normalizeTier("cfp")).toBe("speaking");
  });

  it("maps 'speaker' to speaking", () => {
    expect(normalizeTier("speaker")).toBe("speaking");
  });

  it("maps 'booth' to sponsoring", () => {
    expect(normalizeTier("booth")).toBe("sponsoring");
  });

  it("maps 'sponsor' to sponsoring", () => {
    expect(normalizeTier("Sponsor")).toBe("sponsoring");
  });

  it("maps undefined to attending", () => {
    expect(normalizeTier(undefined)).toBe("attending");
  });

  it("maps unrecognized strings to attending", () => {
    expect(normalizeTier("attendee")).toBe("attending");
    expect(normalizeTier("general")).toBe("attending");
    expect(normalizeTier("")).toBe("attending");
  });
});

// ── findEventTier ────────────────────────────────────────────────────────────

describe("findEventTier", () => {
  it("finds a speaking tier by 'speaker' keyword", () => {
    const event = makeEvent([{ tier: "Speaker" }, { tier: "Attendee" }]);
    expect(findEventTier(event, "speaking")?.tier).toBe("Speaker");
  });

  it("finds a sponsoring tier by 'sponsor' keyword", () => {
    const event = makeEvent([{ tier: "Sponsor" }, { tier: "Attendee" }]);
    expect(findEventTier(event, "sponsoring")?.tier).toBe("Sponsor");
  });

  it("finds an attending tier by 'attendee' keyword", () => {
    const event = makeEvent([{ tier: "Attendee" }, { tier: "Speaker" }]);
    expect(findEventTier(event, "attending")?.tier).toBe("Attendee");
  });

  it("falls back to first tier when no attending keyword matches", () => {
    const event = makeEvent([{ tier: "VIP" }, { tier: "Speaker" }]);
    expect(findEventTier(event, "attending")?.tier).toBe("VIP");
  });

  it("returns undefined when event has no tiers", () => {
    const event = makeEvent([]);
    expect(findEventTier(event, "speaking")).toBeUndefined();
  });
});

// ── buildChecklist ───────────────────────────────────────────────────────────

describe("buildChecklist", () => {
  it("returns 6 tasks for attending tier", () => {
    const checklist = buildChecklist(makeEvent(), "attending");
    expect(checklist).toHaveLength(6);
  });

  it("returns 10 tasks for speaking tier (6 attending + 4 CFP tasks)", () => {
    const checklist = buildChecklist(makeEvent(), "speaking");
    expect(checklist).toHaveLength(10);
  });

  it("returns 9 tasks for sponsoring tier (6 attending + 3 sponsor tasks)", () => {
    const checklist = buildChecklist(makeEvent(), "sponsoring");
    expect(checklist).toHaveLength(9);
  });

  it("all tasks start as not completed", () => {
    const checklist = buildChecklist(makeEvent(), "attending");
    expect(checklist.every((t) => t.completed === false)).toBe(true);
  });

  it("populates deadline on register task when event tier has a cited deadline", () => {
    const event = makeEvent([{ tier: "Attendee", deadline: "2025-09-01" }]);
    const checklist = buildChecklist(event, "attending");
    const registerTask = checklist.find((t) => t.task === "Register for event");
    expect(registerTask?.deadline).toBe("2025-09-01");
    expect(registerTask?.deadlineSourceUrl).toBe("https://example.com/register");
  });

  it("leaves deadline undefined when tier has no cited deadline", () => {
    const event = makeEvent([{ tier: "Attendee" }]); // no deadline
    const checklist = buildChecklist(event, "attending");
    const registerTask = checklist.find((t) => t.task === "Register for event");
    expect(registerTask?.deadline).toBeUndefined();
  });

  it("populates CFP deadline on submit task when speaking tier has a cited deadline", () => {
    const event = makeEvent([
      { tier: "Attendee" },
      { tier: "Speaker", deadline: "2025-07-15" },
    ]);
    const checklist = buildChecklist(event, "speaking");
    const cfpTask = checklist.find((t) => t.task === "Submit CFP");
    expect(cfpTask?.deadline).toBe("2025-07-15");
  });
});
