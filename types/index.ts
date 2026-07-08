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
  // Nonprofit/advocacy extras — populated when the org is mission-driven
  issueAreas?: string[];       // ["child welfare", "eminent domain", "homeless rights"]
  movementAlignment?: string;  // "libertarian", "progressive", "conservative", etc.
  geographicReach?: string[];  // cities/states where they operate beyond home base
  nonprofitType?: string;      // "legal advocacy", "direct services", "policy", etc.
}

export type IdeaLane = "trend" | "comparable" | "opportunity" | "law" | "event" | "donor";

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

// Which relaxation-cascade tier produced a match (ADR-0004). Ordered from
// strictest to loosest; the scorer applies a growing penalty down the list.
export type MatchTier = "strict" | "geo_relaxed" | "cause_broadened" | "virtual_floor";

// Server-side match-run state (ADR-0005): floor_ready -> live_running -> done | failed.
export type MatchRunStatus = "floor_ready" | "live_running" | "done" | "failed";

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
  headquarters?: string;
  citiesOfInterest?: string[];
  regionsOfInterest?: string[];
  /** @deprecated Legacy free-text field; use citiesOfInterest + regionsOfInterest */
  areasOfInterest?: string;
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
  isUniversal: boolean;          // sector-wide event, relevant to any org past strict matching (ADR-0007)
  speakers: EventSpeaker[];
  sponsors: EventSponsor[];
  organizerContacts: EventOrganizerContact[];
  participationTiers: EventParticipationTier[];
  donorSignals: DonorSignal[];
  timingSignals: TimingSignal[];
  scrapeCount: number;
  lastScrapedAt?: string;
  /** Every URL that contributed fields to this corpus row (PR5 / ADR-0006). */
  sourceUrls: string[];
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
  matchTier: MatchTier;          // which cascade tier surfaced this match (ADR-0004)
  dismissedReason?: string;      // v2 feedback loop; collected now
  createdAt: string;
}

export interface MatchRun {
  id: string;
  profileId: string;
  status: MatchRunStatus;
  notices: string[];             // honest degradation messages, surfaced in-UI
  error?: string;                // set only when status = "failed"
  startedAt: string;
  finishedAt?: string;
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

// Post-event debrief (Phase 7, v1.5): the "actual" side of planned-vs-actual,
// one per plan (event_debriefs → event_plans). These are the org's OWN reported
// numbers, so — unlike the sourced PLANNED figures on EventPlan — they carry no
// source_url (PRD rule 1 applies only to figures we researched). worth_it +
// notes predate the actuals columns (see migrations 000700 + debrief_actuals).
export type DebriefOutcome = "attended" | "skipped";

export interface EventDebrief {
  id: string;
  planId: string;
  worthIt?: number;              // 1-5 self-rating; absent until answered
  outcome?: DebriefOutcome;      // did the org attend or skip in the end
  actualSpendUsd?: number;       // actual money spent (user-reported, uncited)
  leadsGained?: number;          // leads captured at the event
  contactsGained?: number;       // contacts/connections made
  notes?: string;                // freeform reflection
  createdAt: string;
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
  // Event-lane extras — only populated when lane === "event"
  eventDates?: string;         // "annual, usually March" — never a specific past date
  eventLocation?: string;
  knownPastSponsors?: string[]; // only if citable from evidence
  organizerContact?: string;   // only if citable from evidence
  sponsorCost?: string;        // only if citable from evidence
  // Donor-lane extras — only populated when lane === "donor"
  donorType?: "individual" | "foundation" | "pac" | "corporate";
  approachAngle?: string;      // how to make first contact, grounded in evidence
}

// ---------------------------------------------------------------------------
// Phase 5 outreach drafting (docs/NONPROFIT_EVENTS_PRD.md → "Outreach
// drafting"). The AI prepares; the human sends. Drafts are generated LOCALLY in
// the org's voice and carry the match's cited claims they drew on. Additive —
// mirrors the outreach_drafts table (snake_case in the DB).
// ---------------------------------------------------------------------------

export type OutreachDraftType = "sponsor_pitch" | "cfp_abstract" | "intro_email";
export type OutreachModelRoute = "local" | "cloud" | "fallback:cloud";

export interface OutreachDraft {
  id: string;
  matchId: string;
  draftType: OutreachDraftType;
  body: string;
  evidence: SourcedClaim[];    // the match's cited claims this draft drew on
  modelRoute: OutreachModelRoute;
  createdAt: string;
}
