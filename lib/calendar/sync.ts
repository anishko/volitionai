// Google Calendar deadline sync. Pure helpers are unit-tested; the route
// layer (`app/api/plans/[id]/calendar/route.ts`) wires them to the real API.
import type { PlanChecklistItem } from "@/types";

export interface CalendarEventContext {
  eventName: string;
  tier: string;
}

export interface CalendarEventBody {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
}

/** Items that still need a calendar event created (have deadline, no existing id). */
export function pendingSyncItems(checklist: PlanChecklistItem[]): PlanChecklistItem[] {
  return checklist.filter((item) => item.deadline && !item.calendarEventId);
}

/** Build the Google Calendar API payload for one checklist item. */
export function buildCalendarEventBody(
  item: PlanChecklistItem,
  ctx: CalendarEventContext,
): CalendarEventBody {
  return {
    summary: item.task,
    description: `${ctx.eventName} — ${ctx.tier}`,
    start: { date: item.deadline! },
    end: { date: item.deadline! },
  };
}

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Create one Google Calendar event; returns the created event's id. */
export async function createCalendarEvent(
  accessToken: string,
  body: CalendarEventBody,
): Promise<string> {
  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}
