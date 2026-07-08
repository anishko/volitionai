// Staleness gate for the uniform finalist scrape (ADR-0003, PR6). Structured
// API rows with fresh fields skip Firecrawl; crawler finalists scrape when stale.
import type { Event } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 30;
export const URGENT_STALE_AFTER_DAYS = 7;
export const URGENT_DEADLINE_WINDOW_DAYS = 45;

export function eventNeedsScrape(event: Event, now = new Date()): boolean {
  if (!event.lastScrapedAt) return true;
  const scrapedAt = new Date(event.lastScrapedAt).getTime();
  if (Number.isNaN(scrapedAt)) return true;
  const ageDays = (now.getTime() - scrapedAt) / DAY_MS;
  if (ageDays > STALE_AFTER_DAYS) return true;

  const soonDeadline = event.participationTiers.some((tier) => {
    if (!tier.deadline) return false;
    const deadline = new Date(`${tier.deadline}T00:00:00Z`).getTime();
    if (Number.isNaN(deadline)) return false;
    const daysOut = (deadline - now.getTime()) / DAY_MS;
    return daysOut >= 0 && daysOut <= URGENT_DEADLINE_WINDOW_DAYS;
  });
  return soonDeadline && ageDays > URGENT_STALE_AFTER_DAYS;
}
