// STAGE 5: relaxation-cascade filter + deterministic match scoring
// (ADR-0004). Runs before any cloud LLM so paid tokens only touch finalists.
//
// The old filter was all-or-nothing: strict cause ∩ geography ∩ upcoming, and
// a profile that zeroed it out saw an empty feed with no recourse. The
// cascade makes a run over a non-empty corpus never return empty: strict
// matching first, then fixed relaxation tiers - drop geography, broaden to
// adjacent/universal causes (ADR-0007), finally any upcoming virtual event -
// stopping at the first tier that reaches the floor. Every kept event is
// tagged with the tier that surfaced it; the tier drives a score penalty and
// the honest "we broadened" UI label, so a strict match and a virtual-floor
// match are never presented as the same thing.
import type { DonorSignal, Event, MatchTier, NonprofitProfile } from "@/types";
import { adjacentCauses } from "./adjacency";

// Below this many kept events, the cascade relaxes to the next tier.
export const MATCH_FLOOR = 5;

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

/** State codes implied by the profile's geography text fields. */
function profileStateCodes(profile: NonprofitProfile): Set<string> {
  const codes = new Set<string>();
  const combined = [
    profile.geographyDetail,
    profile.headquarters,
    ...(profile.citiesOfInterest ?? []),
    ...(profile.regionsOfInterest ?? []),
    profile.areasOfInterest,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!combined) return codes;
  for (const [name, code] of Object.entries(US_STATES)) {
    if (combined.includes(name)) codes.add(code);
  }
  for (const m of combined.toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) {
    if (Object.values(US_STATES).includes(m[1])) codes.add(m[1]);
  }
  return codes;
}

function causeOverlap(profile: NonprofitProfile, event: Event): string[] {
  const profileCauses = profile.causeAreas.filter((c) => c !== "other");
  return event.causeAreaTags.filter((t) => profileCauses.includes(t));
}

function isPast(event: Event, today: string): boolean {
  const last = event.endDate ?? event.startDate;
  return Boolean(last && last < today);
}

/**
 * Geography compatibility for the STRICT tier. Tolerates partial fields
 * (crawler candidates may lack location/format): unknowns get the benefit of
 * the doubt here and are differentiated by the score, not dropped.
 */
function geoCompatible(
  profile: NonprofitProfile,
  states: Set<string>,
  event: Event,
): boolean {
  // All supported orgs are U.S.-based; exclude in-person events held abroad.
  if (
    event.format === "in_person" &&
    event.locationCountry &&
    event.locationCountry !== "USA"
  ) {
    return false;
  }
  // A local/regional org with known home states: in-person events must be in
  // one of them to count as strict. Virtual/hybrid reach everywhere; events
  // with unknown state stay strict and let scoring differentiate.
  const localFocus =
    profile.geographyFocus === "local" || profile.geographyFocus === "regional";
  if (localFocus && states.size > 0 && event.format === "in_person" && event.locationState) {
    return states.has(event.locationState);
  }
  return true;
}

/** An event kept by the cascade, tagged with the tier that surfaced it. */
export interface TieredEvent {
  event: Event;
  matchTier: MatchTier;
}

export interface FilterOutcome {
  kept: TieredEvent[];
  /** Loosest tier the cascade had to run to try to fill the floor. */
  deepestTier: MatchTier;
  /** True when any non-strict tier contributed events (drives the UI notice). */
  relaxed: boolean;
  droppedPast: number;
}

const TIER_ORDER: MatchTier[] = ["strict", "geo_relaxed", "cause_broadened", "virtual_floor"];

export function filterCandidates(
  profile: NonprofitProfile,
  events: Event[],
  floor = MATCH_FLOOR,
): FilterOutcome {
  const today = new Date().toISOString().slice(0, 10);
  // Past events never surface, at any tier - relaxation loosens relevance,
  // never truth.
  const upcoming = events.filter((e) => !isPast(e, today));
  const droppedPast = events.length - upcoming.length;

  const states = profileStateCodes(profile);
  const effectiveCauses = profile.causeAreas.filter((c) => c !== "other");
  // A profile whose only cause is "other" can't be cause-filtered; every
  // event passes the cause check and scoring differentiates.
  const causeFilterActive = effectiveCauses.length > 0;
  const adjacent = adjacentCauses(effectiveCauses);

  const causeOk = (e: Event) => !causeFilterActive || causeOverlap(profile, e).length > 0;
  const tierPredicate: Record<MatchTier, (e: Event) => boolean> = {
    strict: (e) => causeOk(e) && geoCompatible(profile, states, e),
    geo_relaxed: (e) => causeOk(e),
    cause_broadened: (e) =>
      e.isUniversal || e.causeAreaTags.some((t) => adjacent.has(t)),
    // Hybrid counts: it can be attended virtually, which is the point of
    // the floor - something the org can actually get to. But even at this
    // last-resort tier we still require cause relevance (or isUniversal) so
    // unrelated virtual events (e.g. tech conferences in the shared corpus)
    // never surface for a cause-specific profile.
    virtual_floor: (e) =>
      (e.format === "virtual" || e.format === "hybrid") &&
      (e.isUniversal || !causeFilterActive || causeOk(e)),
  };

  // Cumulative relaxation: each tier adds events the earlier tiers missed;
  // an event keeps the strictest tier that surfaced it.
  const kept = new Map<string, TieredEvent>();
  let deepestTier: MatchTier = "strict";
  for (const tier of TIER_ORDER) {
    if (tier !== "strict" && kept.size >= floor) break;
    deepestTier = tier;
    for (const event of upcoming) {
      if (!kept.has(event.id) && tierPredicate[tier](event)) {
        kept.set(event.id, { event, matchTier: tier });
      }
    }
  }

  const items = Array.from(kept.values());
  return {
    kept: items,
    deepestTier,
    relaxed: items.some((k) => k.matchTier !== "strict"),
    droppedPast,
  };
}

// Relaxed matches must never outrank strict ones of comparable quality; the
// penalty grows with distance from what the org actually asked for.
const TIER_PENALTY: Record<MatchTier, number> = {
  strict: 0,
  geo_relaxed: 10,
  cause_broadened: 15,
  virtual_floor: 25,
};

/**
 * Deterministic 0-100 match score. Components (max):
 * cause overlap 40, geography fit 20, timing 15, donor signals 15,
 * target-donor alignment 10; minus the match-tier penalty.
 */
export function scoreEvent(
  profile: NonprofitProfile,
  event: Event,
  donorSignals: DonorSignal[],
  tier: MatchTier = "strict",
): number {
  let score = 0;

  // Cause overlap: fraction of the org's causes this event covers. Universal
  // events serve any cause (that is what the flag means), so a broadened
  // universal match earns the neutral baseline rather than zero.
  const profileCauses = profile.causeAreas.filter((c) => c !== "other");
  if (profileCauses.length === 0) {
    score += 20; // "other"-only profile: neutral baseline
  } else {
    const overlap = causeOverlap(profile, event).length;
    if (overlap > 0) {
      score += Math.round(40 * Math.min(1, overlap / profileCauses.length));
    } else if (event.isUniversal) {
      score += 20;
    }
  }

  // Geography fit.
  const states = profileStateCodes(profile);
  const localFocus = profile.geographyFocus === "local" || profile.geographyFocus === "regional";
  if (event.format === "virtual") {
    score += 15;
  } else if (event.locationState && states.has(event.locationState)) {
    score += 20;
  } else if (localFocus && states.size > 0) {
    score += event.format === "hybrid" ? 12 : 5; // travel required for a local org
  } else {
    score += 12; // national org, or geography unknown
  }

  // Timing: sooner (but upcoming) is more actionable.
  if (event.startDate) {
    const daysOut =
      (new Date(event.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysOut >= 0 && daysOut <= 270) score += 15;
    else if (daysOut > 270) score += 10;
  } else {
    score += 7; // date unknown: neither rewarded nor zeroed
  }

  // Donor presence signals (990-confirmed foundations on the event page).
  if (donorSignals.length > 0) {
    score += Math.min(15, 10 + (donorSignals.length - 1) * 3);
  }

  // Target-donor alignment: the event visibly hosts the donor type they want.
  const wantsFoundations = profile.targetDonorType.includes("foundation");
  const wantsCorporate = profile.targetDonorType.includes("corporate");
  if ((wantsFoundations && donorSignals.length > 0) || (wantsCorporate && event.sponsors.length > 0)) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score - TIER_PENALTY[tier]));
}
