// STAGE 5: rules-based candidate filter + deterministic match scoring.
// Runs before any cloud LLM so paid tokens only touch finalists (PRD rule).
// The filter drops clear mismatches; the score (0-100) is explainable math
// over cause overlap, geography fit, timing, and donor signals — not vibes.
import type { DonorSignal, Event, NonprofitProfile } from "@/types";

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

export interface FilterOutcome {
  kept: Event[];
  droppedNoCauseOverlap: number;
  droppedGeography: number;
  droppedPast: number;
}

export function filterCandidates(
  profile: NonprofitProfile,
  events: Event[],
): FilterOutcome {
  const today = new Date().toISOString().slice(0, 10);
  // A profile whose only cause area is "other" can't be cause-filtered; keep
  // all candidates and let scoring + the explainer differentiate.
  const causeFilterActive = profile.causeAreas.some((c) => c !== "other");

  const kept: Event[] = [];
  let droppedNoCauseOverlap = 0;
  let droppedGeography = 0;
  let droppedPast = 0;

  for (const event of events) {
    if (isPast(event, today)) {
      droppedPast += 1;
      continue;
    }
    if (causeFilterActive && causeOverlap(profile, event).length === 0) {
      droppedNoCauseOverlap += 1;
      continue;
    }
    // Geography incompatibility: a non-international org gains nothing from an
    // in-person event in another country. (Demo corpus is US-based.)
    if (
      profile.geographyFocus !== "international" &&
      event.format === "in_person" &&
      event.locationCountry &&
      event.locationCountry !== "USA"
    ) {
      droppedGeography += 1;
      continue;
    }
    kept.push(event);
  }

  return { kept, droppedNoCauseOverlap, droppedGeography, droppedPast };
}

/**
 * Deterministic 0-100 match score. Components (max):
 * cause overlap 40, geography fit 20, timing 15, donor signals 15,
 * target-donor alignment 10.
 */
export function scoreEvent(
  profile: NonprofitProfile,
  event: Event,
  donorSignals: DonorSignal[],
): number {
  let score = 0;

  // Cause overlap: fraction of the org's causes this event covers.
  const profileCauses = profile.causeAreas.filter((c) => c !== "other");
  if (profileCauses.length === 0) {
    score += 20; // "other"-only profile: neutral baseline
  } else {
    const overlap = causeOverlap(profile, event).length;
    score += Math.round(40 * Math.min(1, overlap / profileCauses.length));
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
    score += 12; // national/international org, or geography unknown
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

  return Math.max(0, Math.min(100, score));
}
