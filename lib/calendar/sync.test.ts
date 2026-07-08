import { describe, expect, it } from "vitest";
import { buildCalendarEventBody, pendingSyncItems } from "./sync";
import type { PlanChecklistItem } from "@/types";

function item(overrides: Partial<PlanChecklistItem> & { task: string }): PlanChecklistItem {
  return { completed: false, ...overrides };
}

// ── pendingSyncItems ─────────────────────────────────────────────────────────

describe("pendingSyncItems", () => {
  it("excludes items with no deadline", () => {
    const checklist = [item({ task: "Book travel" })]; // no deadline
    expect(pendingSyncItems(checklist)).toHaveLength(0);
  });

  it("excludes items that already have a calendarEventId (idempotent)", () => {
    const checklist = [item({ task: "Register", deadline: "2025-09-01", calendarEventId: "cal_existing" })];
    expect(pendingSyncItems(checklist)).toHaveLength(0);
  });

  it("includes items that have a deadline but no calendarEventId", () => {
    const checklist = [item({ task: "Submit CFP", deadline: "2025-08-15" })];
    const pending = pendingSyncItems(checklist);
    expect(pending).toHaveLength(1);
    expect(pending[0].task).toBe("Submit CFP");
  });

  it("returns only the pending subset when checklist has mixed items", () => {
    const checklist = [
      item({ task: "Register", deadline: "2025-09-01", calendarEventId: "cal_1" }), // skip
      item({ task: "Book travel" }),                                                   // skip (no deadline)
      item({ task: "Submit CFP", deadline: "2025-08-15" }),                           // include
      item({ task: "Sponsor app", deadline: "2025-07-01" }),                          // include
    ];
    const pending = pendingSyncItems(checklist);
    expect(pending).toHaveLength(2);
    expect(pending.map((p) => p.task)).toEqual(["Submit CFP", "Sponsor app"]);
  });
});

// ── buildCalendarEventBody ───────────────────────────────────────────────────

describe("buildCalendarEventBody", () => {
  const ctx = { eventName: "Liberty Summit 2025", tier: "speaking" };

  it("sets the task name as the event summary", () => {
    const body = buildCalendarEventBody(item({ task: "Submit CFP", deadline: "2025-08-15" }), ctx);
    expect(body.summary).toBe("Submit CFP");
  });

  it("includes event name and tier in the description", () => {
    const body = buildCalendarEventBody(item({ task: "Submit CFP", deadline: "2025-08-15" }), ctx);
    expect(body.description).toContain("Liberty Summit 2025");
    expect(body.description).toContain("speaking");
  });

  it("creates an all-day event using the date field (not dateTime)", () => {
    const body = buildCalendarEventBody(item({ task: "Submit CFP", deadline: "2025-08-15" }), ctx);
    expect(body.start).toEqual({ date: "2025-08-15" });
    expect(body.end).toEqual({ date: "2025-08-15" });
    expect(body.start).not.toHaveProperty("dateTime");
  });
});
