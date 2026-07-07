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
