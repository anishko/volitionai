export interface BusinessProfile {
  businessName: string;
  orgType: string;             // "cafe", "student trading club", "sports team"...
  industry: string;
  city: string;
  state: string;
  audience: string;            // who they serve, in the owner's words
  goals: string[];             // e.g. ["find sponsors", "more foot traffic"]
  voice?: string;              // tone extracted from uploaded past content
  pastContentThemes?: string[];
}

export type IdeaLane = "trend" | "comparable" | "opportunity" | "law";

export interface Evidence {
  claim: string;               // the specific fact this idea rests on
  url: string;                 // REQUIRED — no citation, no card
  sourceName: string;
}

export interface Comparable {
  name: string;
  whyComparable: string;
  notablePlays: string[];      // sponsors, channels, tactics observed
  url: string;
}

// ---------------------------------------------------------------------------
// Nonprofit Events feature (docs/NONPROFIT_EVENTS_PRD.md).
// App-facing shapes for the Supabase tables in supabase/migrations; fields are
// camelCase here, snake_case in the DB. Every sourced field carries sourceUrl:
// citation or no signal.
// ---------------------------------------------------------------------------

export type GeographyFocus = "local" | "regional" | "national" | "international";
export type EventFormat = "in_person" | "virtual" | "hybrid";
export type EventMatchStatus = "recommended" | "saved" | "dismissed";

/** A cited fact: the claim plus the URL it was verified against. */
export interface SourcedClaim {
  claim: string;
  sourceUrl: string;
}

export interface NonprofitProfile {
  id: string;
  userId: string;
  orgName: string;
  website?: string;
  causeAreas: string[];
  geographyFocus?: GeographyFocus;
  geographyDetail?: string;
  orgSize?: string;              // budget range, e.g. "under $500k"
  currentDonorMix: string[];     // individual / foundation / corporate / government
  targetDonorType: string[];     // same vocabulary; what they want more of
  primaryGoal?: string;
  openEndedNotes?: string;
  extractedProfile?: Record<string, unknown>; // LLM-structured profile used for matching
  voiceProfile?: Record<string, unknown>;     // from past-content upload; raw files discarded
  internalFacts?: Record<string, unknown>;    // "Bring Your Numbers" facts; never raw data
  createdAt: string;
  updatedAt: string;
}

export interface EventSpeaker {
  name: string;
  title?: string;
  org?: string;
  linkedinUrl?: string;
  sourceUrl: string;
}

export interface EventSponsor {
  name: string;
  csrContact?: string;
  linkedinUrl?: string;
  sourceUrl: string;
}

export interface EventOrganizerContact {
  name: string;
  role?: string;
  email?: string;
  linkedinUrl?: string;
  sourceUrl: string;
}

export interface EventParticipationTier {
  tier: string;                  // e.g. "attendee", "sponsor", "speaker"
  cost?: string;
  deadline?: string;             // ISO date; absent renders "deadline unknown"
  applyUrl?: string;
  instructions?: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface DonorSignal {
  foundationName: string;
  programOfficer?: string;
  focusArea?: string;
  filingUrl: string;             // ProPublica 990 filing
  eventSourceUrl: string;        // where the foundation appears on the event page
}

/** v1.5 timing intelligence; column ships empty in v1. */
export interface TimingSignal {
  jurisdiction: string;
  sessionStart: string;          // ISO date
  sourceUrl: string;
}

// Note: the events table also keeps raw_scrape_data (full Firecrawl output)
// for re-processing; it is server-side only and deliberately not part of the
// app-facing Event contract.
export interface Event {
  id: string;
  name: string;
  website: string;
  startDate?: string;            // ISO date
  endDate?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: EventFormat;
  causeAreaTags: string[];
  isSeed: boolean;
  speakers: EventSpeaker[];
  sponsors: EventSponsor[];
  organizerContacts: EventOrganizerContact[];
  participationTiers: EventParticipationTier[];
  donorSignals: DonorSignal[];
  timingSignals: TimingSignal[];
  scrapeCount: number;
  lastScrapedAt?: string;
  createdAt: string;
}

export interface EventMatch {
  id: string;
  profileId: string;
  eventId: string;
  matchScore: number;            // 0-100
  whyAttend: string;
  donorSignalCallout?: string;
  evidence: SourcedClaim[];      // min length 1 - enforce in API route
  status: EventMatchStatus;
  dismissedReason?: string;      // v2 feedback loop; collected now
  createdAt: string;
}

export interface PlanChecklistItem {
  task: string;
  deadline?: string;             // ISO date; absent renders "deadline unknown"
  deadlineSourceUrl?: string;
  completed: boolean;
  calendarEventId?: string;      // set after explicit Google Calendar sync
}

export interface EventPlan {
  id: string;
  profileId: string;
  eventId: string;
  participationTier?: string;
  checklist: PlanChecklistItem[];
  calendarSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Phase 2 matching pipeline (docs/NONPROFIT_EVENTS_PRD.md → "Event matching
// pipeline"). ADDITIVE ONLY: new types layered over the existing Event/
// EventMatch/NonprofitProfile contracts above — none of those are edited. The
// v3 follow-up migration (20260707000700) added cause_sub_tags + certificates
// to events; because the base Event interface is frozen, EventWithRoi carries
// those fields as an additive companion the matcher consumes.
// ---------------------------------------------------------------------------

/** The profile shape the matcher consumes. The frozen NonprofitProfile above
 *  predates the v3 migration (20260707000700) that added cause_sub_tags +
 *  budget cap; rather than edit it, the matcher takes this additive companion.
 *  A single adapter (nonprofit/profile-row) maps a DB row into this shape;
 *  until wired, scripts pass a hardcoded TEST_PROFILE. */
export interface NonprofitProfileForMatch extends NonprofitProfile {
  causeSubTags: string[];        // civil-liberties sub-taxonomy; matcher filters on these when present
  annualBudgetCap?: number;      // signals budget sensitivity → virtual events first-class
  budgetPeriod?: string;         // e.g. "2027"
}

/** A certificate / CE credit an event offers — {type, sourceUrl}: citation or
 *  no badge. Mirrors events.certificates_offered (migration 20260707000700). */
export interface CertificateOffered {
  type: string;
  sourceUrl: string;
}

/** Event plus the v3 ROI + sub-taxonomy columns the matcher filters and ranks
 *  on. Additive companion to Event so the base contract stays frozen. */
export interface EventWithRoi extends Event {
  causeSubTags: string[];
  certificatesOffered: CertificateOffered[];
}

/** Why a rules/budget decision was made about a candidate — surfaced honestly
 *  rather than silently applied (e.g. virtual event kept because budget-tight). */
export type MatchCandidateReason =
  | "sub_tag_overlap"
  | "cause_area_overlap"
  | "geography_match"
  | "virtual_first_class"
  | "seed_corpus";

/** A filtered candidate on its way to ranking/explanation — carries the event,
 *  its similarity score, and the human-honest reasons it survived the filter. */
export interface EventMatchCandidate {
  event: EventWithRoi;
  similarity: number;            // 0-1 cosine vs profile embedding (0 if rank unavailable)
  reasons: MatchCandidateReason[];
}

/** Everything a single POST /api/events/match run returns: the validated
 *  matches, the events they point at, the cost receipt, and honest run meta
 *  (budget stops, degraded stages, dedupe/validation drops). */
export interface EventMatchRunMeta {
  runId: string;
  queries: string[];
  candidatesConsidered: number;
  finalists: number;
  matchesReturned: number;
  droppedForNoCitation: number;
  duplicatesMerged: number;
  budgetStops: string[];         // e.g. "Tavily budget reached (20 credits)"
  degraded: string[];            // e.g. "Firecrawl unconfigured — live scrape skipped"
  notices: string[];
  cloudModel?: string;
}

export interface EventMatchRunResult {
  matches: EventMatch[];
  events: EventWithRoi[];        // the events referenced by matches (by id)
  receipt: import("./cost").CostReceipt;
  meta: EventMatchRunMeta;
}

export interface IdeaCard {
  id: string;
  lane: IdeaLane;
  idea: string;                // one concrete sentence
  whyItFitsYou: string;        // reasoning tied to the profile
  evidence: Evidence[];        // min length 1 — enforce in API route
  comparables?: Comparable[];  // populated for "comparable" lane
  executionSteps: string[];    // 2-4 concrete steps
  confidence: "high" | "medium" | "low";
  draftContent?: string;       // filled by "draft it" in org voice
  isSample?: boolean;          // true = mocked; UI must show a label
}
