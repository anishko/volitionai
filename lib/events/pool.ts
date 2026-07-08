// Convert provisional pool rows into the scrape-store shape for structured inserts.
import type { Event } from "@/types";
import type { ScrapedEvent } from "./scrape";

export function provisionalToScraped(event: Event): ScrapedEvent {
  return {
    sourceUrl: event.website,
    scrapedAt: event.lastScrapedAt ?? new Date().toISOString(),
    data: {
      isEvent: true,
      name: event.name,
      startDate: event.startDate ?? null,
      endDate: event.endDate ?? null,
      locationCity: event.locationCity ?? null,
      locationState: event.locationState ?? null,
      locationCountry: event.locationCountry ?? null,
      format: event.format ?? null,
      causeAreaTags: event.causeAreaTags,
      speakers: [],
      sponsors: [],
      organizerContacts: [],
      participationTiers: [],
    },
  };
}

export function rebuildEventPool(
  corpus: Event[],
  discovered: Event[],
  provisionals: Event[],
): Event[] {
  const byId = new Map(corpus.map((e) => [e.id, e]));
  for (const row of discovered) byId.set(row.id, row);
  const discoveredWebsites = new Set(discovered.map((e) => e.website.toLowerCase()));
  for (const p of provisionals) {
    if (p.id.startsWith("provisional:") && !discoveredWebsites.has(p.website.toLowerCase())) {
      byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}
