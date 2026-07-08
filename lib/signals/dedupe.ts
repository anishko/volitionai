// Dedupe + staleness policy for the events corpus (PRD "Dedupe" + "Staleness
// policy"). Events are keyed on normalized website domain + name + year; a
// live-search hit matching a seed row MERGES into it rather than duplicating,
// so the shared corpus compounds instead of bloating.
import { collectCitationUrls, type CorpusEvent } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

function domainOf(website: string): string {
  try {
    return new URL(website).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return website.toLowerCase();
  }
}
const normName = (n: string): string => n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const yearOf = (d?: string): string => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : "");

/** Dedupe key: domain + normalized name + year. */
export function dedupeKey(e: CorpusEvent["event"]): string {
  return `${domainOf(e.website)}||${normName(e.name)}||${yearOf(e.startDate)}`;
}

/** Merge b into a (a wins on identity; seed rows are preferred as the base).
 *  Citation URLs, tags, and the richer description are unioned. */
function merge(a: CorpusEvent, b: CorpusEvent): CorpusEvent {
  const base = a.event.isSeed || !b.event.isSeed ? a : b;
  const other = base === a ? b : a;
  const event = {
    ...base.event,
    causeAreaTags: [...new Set([...base.event.causeAreaTags, ...other.event.causeAreaTags])],
    causeSubTags: [...new Set([...base.event.causeSubTags, ...other.event.causeSubTags])],
    certificatesOffered: [...base.event.certificatesOffered, ...other.event.certificatesOffered],
    startDate: base.event.startDate ?? other.event.startDate,
    format: base.event.format ?? other.event.format,
    locationCity: base.event.locationCity ?? other.event.locationCity,
    locationState: base.event.locationState ?? other.event.locationState,
  };
  return {
    event,
    description: base.description.length >= other.description.length ? base.description : other.description,
    citationUrls: collectCitationUrls(event, [...base.citationUrls, ...other.citationUrls]),
  };
}

export interface DedupeResult {
  deduped: CorpusEvent[];
  merged: number;
}

export function dedupeCandidates(candidates: CorpusEvent[]): DedupeResult {
  const byKey = new Map<string, CorpusEvent>();
  let merged = 0;
  for (const c of candidates) {
    const key = dedupeKey(c.event);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, merge(existing, c));
      merged += 1;
    } else {
      byKey.set(key, c);
    }
  }
  return { deduped: [...byKey.values()], merged };
}

/** Staleness policy: re-scrape if last_scraped_at is older than 30 days, or
 *  older than 7 days when any known deadline falls within 45 days. An event
 *  never scraped (no last_scraped_at) is stale. */
export function isStale(event: CorpusEvent["event"], now: number = Date.now()): boolean {
  if (!event.lastScrapedAt) return true;
  const age = now - new Date(event.lastScrapedAt).getTime();
  const deadlines = event.participationTiers
    .map((t) => t.deadline)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));
  const soonDeadline = deadlines.some((t) => t - now <= 45 * DAY && t - now >= 0);
  return soonDeadline ? age > 7 * DAY : age > 30 * DAY;
}
