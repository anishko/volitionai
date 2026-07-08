// Persist a match run to the shared corpus (PRD: the events table is shared
// infrastructure — every run enriches it). Upserts the matched events into
// `events` (dedupe key website+name+start_date → the DB assigns the uuid),
// remaps each in-memory synthetic event id to its DB uuid, then upserts
// `event_matches`. Service-role only (no client policies on these writes).
// Failures degrade the run (logged + surfaced) rather than losing the result.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUrl } from "@/lib/validate";
import type { EventMatch, EventWithRoi } from "@/types";

// --- jsonb field mappers: app camelCase → the DB's snake_case shapes ---------
const mapSpeakers = (xs: EventWithRoi["speakers"]) =>
  xs.map((s) => ({ name: s.name, title: s.title, org: s.org, linkedin_url: s.linkedinUrl, source_url: s.sourceUrl }));
const mapSponsors = (xs: EventWithRoi["sponsors"]) =>
  xs.map((s) => ({ name: s.name, csr_contact: s.csrContact, linkedin_url: s.linkedinUrl, source_url: s.sourceUrl }));
const mapContacts = (xs: EventWithRoi["organizerContacts"]) =>
  xs.map((c) => ({ name: c.name, role: c.role, email: c.email, linkedin_url: c.linkedinUrl, source_url: c.sourceUrl }));
const mapTiers = (xs: EventWithRoi["participationTiers"]) =>
  xs.map((t) => ({ tier: t.tier, cost: t.cost, deadline: t.deadline, apply_url: t.applyUrl, instructions: t.instructions, source_url: t.sourceUrl, verified_at: t.verifiedAt }));
const mapDonorSignals = (xs: EventWithRoi["donorSignals"]) =>
  xs.map((d) => ({ foundation_name: d.foundationName, program_officer: d.programOfficer, focus_area: d.focusArea, filing_url: d.filingUrl, event_source_url: d.eventSourceUrl }));
const mapCerts = (xs: EventWithRoi["certificatesOffered"]) =>
  xs.map((c) => ({ type: c.type, source_url: c.sourceUrl }));

/** Dedupe key mirroring the DB unique(website, name, start_date). */
function eventKey(website: string, name: string, startDate?: string | null): string {
  const host = normalizeUrl(website) ?? website.toLowerCase();
  return `${host}||${name.trim().toLowerCase()}||${startDate ?? ""}`;
}

function eventToRow(e: EventWithRoi) {
  return {
    name: e.name,
    website: e.website,
    start_date: e.startDate ?? null,
    end_date: e.endDate ?? null,
    location_city: e.locationCity ?? null,
    location_state: e.locationState ?? null,
    location_country: e.locationCountry ?? null,
    format: e.format ?? null,
    cause_area_tags: e.causeAreaTags,
    cause_sub_tags: e.causeSubTags,
    certificates_offered: mapCerts(e.certificatesOffered),
    is_seed: e.isSeed,
    speakers: mapSpeakers(e.speakers),
    sponsors: mapSponsors(e.sponsors),
    organizer_contacts: mapContacts(e.organizerContacts),
    participation_tiers: mapTiers(e.participationTiers),
    donor_signals: mapDonorSignals(e.donorSignals),
    timing_signals: e.timingSignals,
    last_scraped_at: e.lastScrapedAt ?? null,
  };
}

export interface PersistResult {
  eventsUpserted: number;
  matchesUpserted: number;
  degraded: string[];
}

/** Upsert events + event_matches for one run. `events` are the matched events;
 *  `matches` reference them by in-memory synthetic id, remapped here to uuids. */
export async function persistMatchRun(
  admin: SupabaseClient,
  args: { profileId: string; events: EventWithRoi[]; matches: EventMatch[] },
): Promise<PersistResult> {
  const degraded: string[] = [];
  if (args.events.length === 0) return { eventsUpserted: 0, matchesUpserted: 0, degraded };

  // 1. Upsert events; DB assigns/returns the uuid per dedupe key.
  const rows = args.events.map(eventToRow);
  const { data: upserted, error: evErr } = await admin
    .from("events")
    .upsert(rows, { onConflict: "website,name,start_date" })
    .select("id,website,name,start_date");
  if (evErr) {
    degraded.push(`Event persistence failed: ${evErr.message}`);
    return { eventsUpserted: 0, matchesUpserted: 0, degraded };
  }

  // key(website,name,start_date) → db uuid
  const idByKey = new Map<string, string>();
  for (const r of upserted ?? []) {
    idByKey.set(eventKey(r.website as string, r.name as string, (r.start_date as string) ?? null), r.id as string);
  }
  // synthetic in-memory event id → db uuid
  const uuidBySynthetic = new Map<string, string>();
  for (const e of args.events) {
    const uuid = idByKey.get(eventKey(e.website, e.name, e.startDate ?? null));
    if (uuid) uuidBySynthetic.set(e.id, uuid);
  }

  // 2. Upsert event_matches with the remapped event_id.
  const matchRows = args.matches
    .map((m) => {
      const eventId = uuidBySynthetic.get(m.eventId);
      if (!eventId) return null;
      return {
        profile_id: args.profileId,
        event_id: eventId,
        match_score: m.matchScore,
        why_attend: m.whyAttend,
        donor_signal_callout: m.donorSignalCallout ?? null,
        evidence: m.evidence.map((ev) => ({ claim: ev.claim, source_url: ev.sourceUrl })),
        status: m.status,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let matchesUpserted = 0;
  if (matchRows.length > 0) {
    const { data: mData, error: mErr } = await admin
      .from("event_matches")
      .upsert(matchRows, { onConflict: "profile_id,event_id" })
      .select("id");
    if (mErr) degraded.push(`Match persistence failed: ${mErr.message}`);
    else matchesUpserted = mData?.length ?? 0;
  }

  return { eventsUpserted: upserted?.length ?? 0, matchesUpserted, degraded };
}
