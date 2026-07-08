// The field-level citation guarantee (code, NOT model) — generalized from the
// Volition card validator (lib/pipeline/validate.ts) to the events pipeline.
// "Citation or no signal": any sourced field whose source_url is missing or not
// in the event's allowed citation set is dropped; any match left without a
// sourced claim is dropped; survivors are stamped verified_at. This makes the
// citation rule a property of the SYSTEM, not a request to the model. Do not weaken it.
import type {
  EventMatch,
  EventWithRoi,
  SourcedClaim,
} from "@/types";
import type { MatchExplanation, ScoredCandidate } from "./signals/schema";
import { clampScore } from "./signals/schema";

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

/** Drop any sourced items whose source_url is missing/invalid (or, when an
 *  allow-set is given, not in it). Field-level enforcement. */
export function dropUnsourced<T extends { sourceUrl?: string }>(
  items: T[],
  allowed?: Set<string>,
): T[] {
  return items.filter((item) => {
    if (!hasValidSource(item)) return false;
    if (!allowed) return true;
    const n = normalizeUrl(item.sourceUrl as string);
    return n !== null && allowed.has(n);
  });
}

/** Strip every unsourced nested field from an event so nothing unsourced can
 *  ever render or be matched on. Idempotent. */
export function validateEventFields(event: EventWithRoi): EventWithRoi {
  return {
    ...event,
    speakers: dropUnsourced(event.speakers),
    sponsors: dropUnsourced(event.sponsors),
    organizerContacts: dropUnsourced(event.organizerContacts),
    participationTiers: dropUnsourced(event.participationTiers),
    certificatesOffered: dropUnsourced(event.certificatesOffered),
    donorSignals: event.donorSignals.filter(
      (d) => normalizeUrl(d.filingUrl) !== null && normalizeUrl(d.eventSourceUrl) !== null,
    ),
  };
}

export interface ValidatedMatch {
  match: EventMatch;
  keptEvidence: number;
  droppedEvidence: number;
}

/** Validate one explainer output against its candidate: keep only evidence
 *  citing a URL in the event's allowed set, drop the whole match if none
 *  survive, clamp the score, and stamp verified_at (created_at). A donor-signal
 *  callout survives only if the event actually carries a sourced donor signal. */
export function validateEventMatch(args: {
  explanation: MatchExplanation;
  candidate: ScoredCandidate;
  profileId: string;
}): ValidatedMatch | null {
  const { explanation, candidate, profileId } = args;

  const allowed = new Set<string>();
  for (const u of candidate.citationUrls) {
    const n = normalizeUrl(u);
    if (n) allowed.add(n);
  }

  const evidence: SourcedClaim[] = [];
  let dropped = 0;
  for (const ev of explanation.evidence) {
    const n = normalizeUrl(ev.sourceUrl);
    if (n !== null && allowed.has(n)) evidence.push({ claim: ev.claim, sourceUrl: ev.sourceUrl });
    else dropped += 1;
  }

  // Citation or no signal: a match with no sourced claim is not a match.
  if (evidence.length === 0) return null;

  // Callout only survives if a real, sourced donor signal backs it.
  const donorSignalCallout =
    candidate.event.donorSignals.length > 0 ? explanation.donorSignalCallout : undefined;

  const now = new Date().toISOString();
  const match: EventMatch = {
    id: `match_${candidate.event.id}`,
    profileId,
    eventId: candidate.event.id,
    matchScore: clampScore(explanation.matchScore),
    whyAttend: explanation.whyAttend,
    donorSignalCallout,
    evidence,
    status: "recommended",
    createdAt: now, // verified_at stamp for the match
  };

  return { match, keptEvidence: evidence.length, droppedEvidence: dropped };
}
