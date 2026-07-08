// Mapping between the events / event_matches tables (snake_case, including
// the jsonb payload shapes documented in the migrations) and the app-facing
// contracts in types/index.ts (camelCase).
import type {
  DonorSignal,
  Event,
  EventMatch,
  EventOrganizerContact,
  EventParticipationTier,
  EventSpeaker,
  EventSponsor,
  SourcedClaim,
  TimingSignal,
} from "@/types";

export interface EventRow {
  id: string;
  name: string;
  website: string;
  start_date: string | null;
  end_date: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  format: Event["format"] | null;
  cause_area_tags: string[];
  is_seed: boolean;
  speakers: Record<string, unknown>[];
  sponsors: Record<string, unknown>[];
  organizer_contacts: Record<string, unknown>[];
  participation_tiers: Record<string, unknown>[];
  donor_signals: Record<string, unknown>[];
  timing_signals: Record<string, unknown>[];
  scrape_count: number;
  last_scraped_at: string | null;
  created_at: string;
}

export interface EventMatchRow {
  id: string;
  profile_id: string;
  event_id: string;
  match_score: number;
  why_attend: string | null;
  donor_signal_callout: string | null;
  evidence: Record<string, unknown>[];
  status: EventMatch["status"];
  dismissed_reason: string | null;
  created_at: string;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

export function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    locationCity: row.location_city ?? undefined,
    locationState: row.location_state ?? undefined,
    locationCountry: row.location_country ?? undefined,
    format: row.format ?? undefined,
    causeAreaTags: row.cause_area_tags ?? [],
    isSeed: row.is_seed,
    speakers: (row.speakers ?? []).flatMap((s): EventSpeaker[] => {
      const name = str(s.name);
      const sourceUrl = str(s.source_url);
      if (!name || !sourceUrl) return [];
      return [{ name, title: str(s.title), org: str(s.org), linkedinUrl: str(s.linkedin_url), sourceUrl }];
    }),
    sponsors: (row.sponsors ?? []).flatMap((s): EventSponsor[] => {
      const name = str(s.name);
      const sourceUrl = str(s.source_url);
      if (!name || !sourceUrl) return [];
      return [{ name, csrContact: str(s.csr_contact), linkedinUrl: str(s.linkedin_url), sourceUrl }];
    }),
    organizerContacts: (row.organizer_contacts ?? []).flatMap((c): EventOrganizerContact[] => {
      const name = str(c.name);
      const sourceUrl = str(c.source_url);
      if (!name || !sourceUrl) return [];
      return [{ name, role: str(c.role), email: str(c.email), linkedinUrl: str(c.linkedin_url), sourceUrl }];
    }),
    participationTiers: (row.participation_tiers ?? []).flatMap((t): EventParticipationTier[] => {
      const tier = str(t.tier);
      const sourceUrl = str(t.source_url);
      const verifiedAt = str(t.verified_at);
      if (!tier || !sourceUrl || !verifiedAt) return [];
      return [{
        tier,
        cost: str(t.cost),
        deadline: str(t.deadline),
        applyUrl: str(t.apply_url),
        instructions: str(t.instructions),
        sourceUrl,
        verifiedAt,
      }];
    }),
    donorSignals: (row.donor_signals ?? []).flatMap((d): DonorSignal[] => {
      const foundationName = str(d.foundation_name);
      const filingUrl = str(d.filing_url);
      const eventSourceUrl = str(d.event_source_url);
      if (!foundationName || !filingUrl || !eventSourceUrl) return [];
      return [{
        foundationName,
        programOfficer: str(d.program_officer),
        focusArea: str(d.focus_area),
        filingUrl,
        eventSourceUrl,
      }];
    }),
    timingSignals: (row.timing_signals ?? []).flatMap((t): TimingSignal[] => {
      const jurisdiction = str(t.jurisdiction);
      const sessionStart = str(t.session_start);
      const sourceUrl = str(t.source_url);
      if (!jurisdiction || !sessionStart || !sourceUrl) return [];
      return [{ jurisdiction, sessionStart, sourceUrl }];
    }),
    scrapeCount: row.scrape_count,
    lastScrapedAt: row.last_scraped_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function speakersToJson(speakers: EventSpeaker[]): Record<string, unknown>[] {
  return speakers.map((s) => ({
    name: s.name,
    title: s.title ?? null,
    org: s.org ?? null,
    linkedin_url: s.linkedinUrl ?? null,
    source_url: s.sourceUrl,
  }));
}

export function sponsorsToJson(sponsors: EventSponsor[]): Record<string, unknown>[] {
  return sponsors.map((s) => ({
    name: s.name,
    csr_contact: s.csrContact ?? null,
    linkedin_url: s.linkedinUrl ?? null,
    source_url: s.sourceUrl,
  }));
}

export function contactsToJson(contacts: EventOrganizerContact[]): Record<string, unknown>[] {
  return contacts.map((c) => ({
    name: c.name,
    role: c.role ?? null,
    email: c.email ?? null,
    linkedin_url: c.linkedinUrl ?? null,
    source_url: c.sourceUrl,
  }));
}

export function tiersToJson(tiers: EventParticipationTier[]): Record<string, unknown>[] {
  return tiers.map((t) => ({
    tier: t.tier,
    cost: t.cost ?? null,
    deadline: t.deadline ?? null,
    apply_url: t.applyUrl ?? null,
    instructions: t.instructions ?? null,
    source_url: t.sourceUrl,
    verified_at: t.verifiedAt,
  }));
}

export function donorSignalsToJson(signals: DonorSignal[]): Record<string, unknown>[] {
  return signals.map((d) => ({
    foundation_name: d.foundationName,
    program_officer: d.programOfficer ?? null,
    focus_area: d.focusArea ?? null,
    filing_url: d.filingUrl,
    event_source_url: d.eventSourceUrl,
  }));
}

export function rowToEventMatch(row: EventMatchRow): EventMatch {
  return {
    id: row.id,
    profileId: row.profile_id,
    eventId: row.event_id,
    matchScore: row.match_score,
    whyAttend: row.why_attend ?? "",
    donorSignalCallout: row.donor_signal_callout ?? undefined,
    evidence: (row.evidence ?? []).flatMap((e): SourcedClaim[] => {
      const claim = str(e.claim);
      const sourceUrl = str(e.source_url);
      return claim && sourceUrl ? [{ claim, sourceUrl }] : [];
    }),
    status: row.status,
    dismissedReason: row.dismissed_reason ?? undefined,
    createdAt: row.created_at,
  };
}

export function evidenceToJson(evidence: SourcedClaim[]): Record<string, unknown>[] {
  return evidence.map((e) => ({ claim: e.claim, source_url: e.sourceUrl }));
}
