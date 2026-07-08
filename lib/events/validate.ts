// The field-level citation guarantee (CODE, not the model). Generalized from
// the Volition card validator (lib/pipeline/validate.ts) to the events pipeline
// and adapted to the app-facing Event type. "Citation or no signal": any
// sourced field whose source_url is missing or malformed is dropped, and any
// match left without a single sourced claim is dropped by the caller. This
// makes the citation rule a property of the SYSTEM, not a request to the model.
// Do not weaken it — it is the product's first differentiator.
import type { Event, SourcedClaim } from "@/types";

/** Normalize for set membership: lowercase host, drop fragment + trailing slash.
 *  Robust to trivial formatting differences, strict about origin+path. */
export function normalizeUrl(u: string): string | null {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    let s = `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.search}`;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/** True when an item carries a syntactically valid http(s) source_url. */
export function hasValidSource(item: { sourceUrl?: string }): boolean {
  return typeof item.sourceUrl === "string" && normalizeUrl(item.sourceUrl) !== null;
}

/** Drop any sourced items whose source_url is missing/invalid. Field-level
 *  enforcement, idempotent. */
function dropUnsourced<T extends { sourceUrl?: string }>(items: T[]): T[] {
  return items.filter(hasValidSource);
}

/** Strip every unsourced nested field from an event so nothing unsourced can
 *  render or be matched on. Defense-in-depth: rowToEvent already drops these on
 *  read, but community/live sources enter through other paths. Idempotent. */
export function validateEventFields(event: Event): Event {
  return {
    ...event,
    speakers: dropUnsourced(event.speakers),
    sponsors: dropUnsourced(event.sponsors),
    organizerContacts: dropUnsourced(event.organizerContacts),
    participationTiers: dropUnsourced(event.participationTiers).filter(
      (t) => typeof t.verifiedAt === "string" && t.verifiedAt.length > 0,
    ),
    donorSignals: event.donorSignals.filter(
      (d) => normalizeUrl(d.filingUrl) !== null && normalizeUrl(d.eventSourceUrl) !== null,
    ),
  };
}

/** Keep only evidence claims whose source_url is in the event's allowed
 *  citation set. Returns the surviving claims and the dropped count. The caller
 *  drops the whole match when nothing survives (citation or no signal). */
export function validateEvidence(
  evidence: SourcedClaim[],
  allowedUrls: Set<string>,
): { kept: SourcedClaim[]; dropped: number } {
  const normalizedAllowed = new Set<string>();
  for (const u of allowedUrls) {
    const n = normalizeUrl(u);
    if (n) normalizedAllowed.add(n);
  }
  const kept: SourcedClaim[] = [];
  let dropped = 0;
  for (const e of evidence) {
    const n = normalizeUrl(e.sourceUrl);
    if (n !== null && normalizedAllowed.has(n)) kept.push({ claim: e.claim, sourceUrl: e.sourceUrl });
    else dropped += 1;
  }
  return { kept, dropped };
}
