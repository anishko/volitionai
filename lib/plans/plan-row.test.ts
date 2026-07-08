import { describe, expect, it } from "vitest";
import { checklistFromJson, checklistToJson } from "./plan-row";

// ── checklistFromJson ────────────────────────────────────────────────────────

describe("checklistFromJson", () => {
  it("converts a raw DB row array into PlanChecklistItems", () => {
    const raw = [{ task: "Register for event", completed: false, deadline: null, deadline_source_url: null, calendar_event_id: null }];
    const result = checklistFromJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe("Register for event");
    expect(result[0].completed).toBe(false);
  });

  it("maps completed: true correctly", () => {
    const raw = [{ task: "Book travel", completed: true, deadline: null, deadline_source_url: null, calendar_event_id: null }];
    expect(checklistFromJson(raw)[0].completed).toBe(true);
  });

  it("maps deadline and deadlineSourceUrl from snake_case DB columns", () => {
    const raw = [{
      task: "Submit CFP",
      completed: false,
      deadline: "2025-08-01",
      deadline_source_url: "https://example.com/cfp",
      calendar_event_id: null,
    }];
    const item = checklistFromJson(raw)[0];
    expect(item.deadline).toBe("2025-08-01");
    expect(item.deadlineSourceUrl).toBe("https://example.com/cfp");
  });

  it("maps calendarEventId from calendar_event_id", () => {
    const raw = [{ task: "Register", completed: false, deadline: null, deadline_source_url: null, calendar_event_id: "cal_abc123" }];
    expect(checklistFromJson(raw)[0].calendarEventId).toBe("cal_abc123");
  });

  it("skips entries with missing or empty task strings", () => {
    const raw = [
      { task: "", completed: false, deadline: null, deadline_source_url: null, calendar_event_id: null },
      { task: "Valid task", completed: false, deadline: null, deadline_source_url: null, calendar_event_id: null },
      { completed: false, deadline: null, deadline_source_url: null, calendar_event_id: null },
    ];
    const result = checklistFromJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe("Valid task");
  });

  it("returns empty array for empty input", () => {
    expect(checklistFromJson([])).toEqual([]);
  });
});

// ── checklistToJson ──────────────────────────────────────────────────────────

describe("checklistToJson", () => {
  it("serialises PlanChecklistItems into DB-ready records", () => {
    const items = [{ task: "Register for event", completed: false }];
    const result = checklistToJson(items);
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe("Register for event");
    expect(result[0].completed).toBe(false);
    expect(result[0].deadline).toBeNull();
    expect(result[0].deadline_source_url).toBeNull();
    expect(result[0].calendar_event_id).toBeNull();
  });

  it("preserves deadline and deadlineSourceUrl as snake_case keys", () => {
    const items = [{ task: "Submit CFP", completed: false, deadline: "2025-08-01", deadlineSourceUrl: "https://example.com/cfp" }];
    const row = checklistToJson(items)[0];
    expect(row.deadline).toBe("2025-08-01");
    expect(row.deadline_source_url).toBe("https://example.com/cfp");
  });

  it("round-trips through checklistFromJson without data loss", () => {
    const original = [
      { task: "Register", completed: true, deadline: "2025-09-01", deadlineSourceUrl: "https://x.com", calendarEventId: "cal_1" },
      { task: "Book travel", completed: false },
    ];
    const roundTripped = checklistFromJson(checklistToJson(original));
    expect(roundTripped[0].task).toBe("Register");
    expect(roundTripped[0].completed).toBe(true);
    expect(roundTripped[0].deadline).toBe("2025-09-01");
    expect(roundTripped[0].calendarEventId).toBe("cal_1");
    expect(roundTripped[1].task).toBe("Book travel");
    expect(roundTripped[1].deadline).toBeUndefined();
  });
});
