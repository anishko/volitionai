// Eventbrite Events API — discovers upcoming conferences and events by keyword.
// Requires EVENTBRITE_API_KEY (free; create an app at eventbrite.com/platform/api).
// Returns name, dates, location, organizer, and URL — all citable in event-lane cards.
import type { Evidence } from "./tavily";
export interface EventbriteEvent {
  id: string;
  name: string;
  description: string;       // trimmed to 600 chars
  url: string;               // canonical Eventbrite URL — usable as citation
  startUtc: string;          // ISO datetime string
  endUtc: string;
  timezone: string;
  venueName?: string;
  venueCity?: string;
  venueState?: string;
  organizerName?: string;
  organizerUrl?: string;
  isFree: boolean;
  source: "eventbrite";
  query: string;
}

export interface EventbriteSearchOutcome {
  events: EventbriteEvent[];
  latencyMs: number;
}

const BASE = "https://www.eventbriteapi.com/v3";

export async function eventbriteSearch(
  query: string,
  maxResults = 5,
  timeoutMs = 15_000,
): Promise<EventbriteSearchOutcome> {
  if (!process.env.EVENTBRITE_API_KEY) {
    throw new Error("EVENTBRITE_API_KEY is not set (needed for event discovery)");
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      q: query,
      expand: "organizer,venue",
      // Only return events that haven't started yet.
      "start_date.range_start": new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      page_size: String(Math.min(maxResults, 50)),
    });
    const res = await fetch(`${BASE}/events/search/?${params}`, {
      headers: {
        Authorization: `Bearer ${process.env.EVENTBRITE_API_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Eventbrite ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const events: EventbriteEvent[] = (
      (data?.events ?? []) as Record<string, unknown>[]
    )
      .slice(0, maxResults)
      .map((e) => {
        const venue = e.venue as Record<string, unknown> | undefined;
        const address = venue?.address as Record<string, unknown> | undefined;
        const organizer = e.organizer as Record<string, unknown> | undefined;
        const start = e.start as Record<string, unknown> | undefined;
        const end = e.end as Record<string, unknown> | undefined;
        const nameObj = e.name as Record<string, unknown> | undefined;
        const descObj = e.description as Record<string, unknown> | undefined;
        return {
          id: String(e.id ?? ""),
          name: String(nameObj?.text ?? nameObj?.html ?? ""),
          description: String(descObj?.text ?? descObj?.html ?? "").slice(0, 600),
          url: String(e.url ?? ""),
          startUtc: String(start?.utc ?? ""),
          endUtc: String(end?.utc ?? ""),
          timezone: String(start?.timezone ?? "UTC"),
          venueName: venue ? String(venue.name ?? "") || undefined : undefined,
          venueCity: address ? String(address.city ?? "") || undefined : undefined,
          venueState: address ? String(address.region ?? "") || undefined : undefined,
          organizerName: organizer ? String(organizer.name ?? "") || undefined : undefined,
          organizerUrl: organizer ? String(organizer.url ?? "") || undefined : undefined,
          isFree: Boolean(e.is_free),
          source: "eventbrite" as const,
          query,
        };
      });
    return { events, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Convert an Eventbrite event record into the shared Evidence format for synthesis. */
export function eventToEvidence(event: EventbriteEvent): Evidence | null {
  if (!event.url) return null; // no citable URL — skip
  const location = [event.venueCity, event.venueState].filter(Boolean).join(", ");
  const dateStr = event.startUtc
    ? new Date(event.startUtc).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const parts: string[] = [];
  if (event.description) parts.push(event.description);
  if (event.organizerName) parts.push(`Organizer: ${event.organizerName}`);
  if (event.isFree) parts.push("Free to attend");
  return {
    url: event.url,
    title: [event.name, location && `(${location})`, dateStr && dateStr].filter(Boolean).join(" — "),
    snippet: parts.join(". ").slice(0, 800),
    publishedAt: event.startUtc || undefined,
    source: "eventbrite",
    query: event.query,
  };
}
