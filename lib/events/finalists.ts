// Finalist scrape selection for the filter-first pipeline (ADR-0003, PR6).
import type { Event } from "@/types";
import type { EventSearchCandidate } from "./search";
import { eventNeedsScrape } from "./staleness";

export function finalistsToScrape(
  finalists: Event[],
  maxPages: number,
  now = new Date(),
): EventSearchCandidate[] {
  return finalists
    .filter((event) => eventNeedsScrape(event, now))
    .slice(0, maxPages)
    .map((event) => ({
      url: event.website,
      title: event.name,
      snippet: "",
      query: "finalist",
    }));
}

export function countSkippedFreshStructured(finalists: Event[], now = new Date()): number {
  return finalists.filter((event) => !eventNeedsScrape(event, now)).length;
}
