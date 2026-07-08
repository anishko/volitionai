// STAGE 7: persistence. Server-side only (service role): the events corpus
// and event_matches have no client write policies by design. Live-discovered
// events merge on identity_key (ADR-0006) — every contributing source URL is
// preserved so cards can cite all of them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DonorSignal, Event, MatchTier, SourcedClaim } from "@/types";
import { isMissingIdentityKeyColumn, isMissingMatchTierColumn } from "@/lib/supabase/schema-errors";
import { identityKeyFor } from "./identity";
import {
  mergeDiscoveredPayload,
  snapshotFromInsert,
  type CorpusSnapshot,
  type DiscoveredPayload,
} from "./merge-fields";
import {
  contactsToJson,
  donorSignalsToJson,
  evidenceToJson,
  rowToEvent,
  rowToEventMatch,
  speakersToJson,
  sponsorsToJson,
  tiersToJson,
  type EventMatchRow,
  type EventRow,
} from "./event-row";
import type { ScrapedEvent } from "./scrape";

export async function loadEventCorpus(admin: SupabaseClient): Promise<Event[]> {
  const { data, error } = await admin.from("events").select("*");
  if (error) throw error;
  return ((data ?? []) as EventRow[]).map(rowToEvent);
}

export async function loadEventById(
  client: SupabaseClient,
  id: string,
): Promise<Event | null> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? rowToEvent(data as EventRow) : null;
}

function eventToSnapshot(event: Event, identityKey: string): CorpusSnapshot {
  return {
    id: event.id,
    identityKey,
    name: event.name,
    website: event.website,
    sourceUrls: event.sourceUrls.length > 0 ? event.sourceUrls : [event.website],
    startDate: event.startDate,
    endDate: event.endDate,
    locationCity: event.locationCity,
    locationState: event.locationState,
    locationCountry: event.locationCountry,
    format: event.format,
    causeAreaTags: event.causeAreaTags,
    isSeed: event.isSeed,
    scrapeCount: event.scrapeCount,
    speakers: event.speakers,
    sponsors: event.sponsors,
    organizerContacts: event.organizerContacts,
    participationTiers: event.participationTiers,
    lastScrapedAt: event.lastScrapedAt,
  };
}

function scrapedToPayload(scraped: ScrapedEvent, organizerUrl?: string): DiscoveredPayload {
  const { data, sourceUrl, scrapedAt } = scraped;
  const identityKey = identityKeyFor({
    name: data.name,
    website: sourceUrl,
    organizerUrl,
    startDate: data.startDate ?? undefined,
    locationCity: data.locationCity ?? undefined,
  });
  return {
    identityKey,
    name: data.name,
    website: sourceUrl,
    sourceUrl,
    startDate: data.startDate ?? undefined,
    endDate: data.endDate ?? undefined,
    locationCity: data.locationCity ?? undefined,
    locationState: data.locationState ?? undefined,
    locationCountry: data.locationCountry ?? undefined,
    format: data.format ?? undefined,
    causeAreaTags: data.causeAreaTags,
    speakers: data.speakers.map((s) => ({
      name: s.name,
      title: s.title ?? undefined,
      org: s.org ?? undefined,
      sourceUrl,
    })),
    sponsors: data.sponsors.map((s) => ({ name: s.name, sourceUrl })),
    organizerContacts: data.organizerContacts.map((c) => ({
      name: c.name,
      role: c.role ?? undefined,
      email: c.email ?? undefined,
      sourceUrl,
    })),
    participationTiers: data.participationTiers.map((t) => ({
      tier: t.tier,
      cost: t.cost ?? undefined,
      deadline: t.deadline ?? undefined,
      applyUrl: t.applyUrl ?? undefined,
      instructions: t.instructions ?? undefined,
      sourceUrl,
      verifiedAt: scrapedAt,
    })),
    scrapedAt,
    isSeed: false,
  };
}

function snapshotToRowColumns(snapshot: CorpusSnapshot, enrichment?: Record<string, unknown>) {
  return {
    name: snapshot.name,
    website: snapshot.website,
    identity_key: snapshot.identityKey,
    source_urls: snapshot.sourceUrls,
    start_date: snapshot.startDate ?? null,
    end_date: snapshot.endDate ?? null,
    location_city: snapshot.locationCity ?? null,
    location_state: snapshot.locationState ?? null,
    location_country: snapshot.locationCountry ?? null,
    format: snapshot.format ?? null,
    cause_area_tags: snapshot.causeAreaTags,
    is_seed: snapshot.isSeed,
    speakers: speakersToJson(snapshot.speakers),
    sponsors: sponsorsToJson(snapshot.sponsors),
    organizer_contacts: contactsToJson(snapshot.organizerContacts),
    participation_tiers: tiersToJson(snapshot.participationTiers),
    scrape_count: snapshot.scrapeCount,
    last_scraped_at: snapshot.lastScrapedAt ?? null,
    ...enrichment,
  };
}

function buildIdentityIndex(corpus: Event[]): Map<string, Event> {
  const byIdentity = new Map<string, Event>();
  for (const event of corpus) {
    const key = identityKeyFor({
      name: event.name,
      website: event.website,
      startDate: event.startDate,
      locationCity: event.locationCity,
    });
    byIdentity.set(key, event);
  }
  return byIdentity;
}

export interface UpsertEventsOutcome {
  events: Event[];
  inserted: number;
  merged: number;
}

/** Legacy domain+name dedupe when identity_key column is not applied yet. */
function legacySameEvent(scraped: ScrapedEvent, existing: Event): boolean {
  try {
    const a = new URL(scraped.sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    const b = new URL(existing.website).hostname.replace(/^www\./, "").toLowerCase();
    if (a !== b) return false;
  } catch {
    return false;
  }
  const tokens = (name: string) =>
    new Set(name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2));
  const left = tokens(scraped.data.name);
  const right = tokens(existing.name);
  if (left.size === 0 || right.size === 0) return true;
  let shared = 0;
  for (const t of left) if (right.has(t)) shared += 1;
  return shared / Math.min(left.size, right.size) >= 0.5;
}

async function upsertDiscoveredEventsLegacy(
  admin: SupabaseClient,
  scrapedEvents: ScrapedEvent[],
  corpus: Event[],
): Promise<UpsertEventsOutcome> {
  const events: Event[] = [];
  let inserted = 0;
  let merged = 0;

  for (const scraped of scrapedEvents) {
    const existing = corpus.find((e) => legacySameEvent(scraped, e));
    const { data, sourceUrl, scrapedAt } = scraped;
    const enrichment = {
      speakers: speakersToJson(
        data.speakers.map((s) => ({
          name: s.name,
          title: s.title ?? undefined,
          org: s.org ?? undefined,
          sourceUrl,
        })),
      ),
      sponsors: sponsorsToJson(data.sponsors.map((s) => ({ name: s.name, sourceUrl }))),
      organizer_contacts: contactsToJson(
        data.organizerContacts.map((c) => ({
          name: c.name,
          role: c.role ?? undefined,
          email: c.email ?? undefined,
          sourceUrl,
        })),
      ),
      participation_tiers: tiersToJson(
        data.participationTiers.map((t) => ({
          tier: t.tier,
          cost: t.cost ?? undefined,
          deadline: t.deadline ?? undefined,
          applyUrl: t.applyUrl ?? undefined,
          instructions: t.instructions ?? undefined,
          sourceUrl,
          verifiedAt: scrapedAt,
        })),
      ),
      raw_scrape_data: { source_url: sourceUrl, scraped_at: scrapedAt, extracted: data },
      last_scraped_at: scrapedAt,
    };

    if (existing) {
      const { data: row, error } = await admin
        .from("events")
        .update({
          ...enrichment,
          start_date: existing.startDate ?? data.startDate ?? null,
          end_date: existing.endDate ?? data.endDate ?? null,
          location_city: existing.locationCity ?? data.locationCity ?? null,
          location_state: existing.locationState ?? data.locationState ?? null,
          location_country: existing.locationCountry ?? data.locationCountry ?? null,
          format: existing.format ?? data.format ?? null,
          cause_area_tags: Array.from(new Set([...existing.causeAreaTags, ...data.causeAreaTags])),
          scrape_count: existing.scrapeCount + 1,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      merged += 1;
      events.push(rowToEvent(row as EventRow));
      continue;
    }

    const { data: row, error } = await admin
      .from("events")
      .insert({
        name: data.name,
        website: sourceUrl,
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        location_city: data.locationCity ?? null,
        location_state: data.locationState ?? null,
        location_country: data.locationCountry ?? null,
        format: data.format ?? null,
        cause_area_tags: data.causeAreaTags,
        is_seed: false,
        ...enrichment,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    inserted += 1;
    events.push(rowToEvent(row as EventRow));
  }

  return { events, inserted, merged };
}

export async function upsertDiscoveredEvents(
  admin: SupabaseClient,
  scrapedEvents: ScrapedEvent[],
  corpus: Event[],
  organizerUrls: Record<string, string> = {},
): Promise<UpsertEventsOutcome> {
  if (scrapedEvents.length === 0) return { events: [], inserted: 0, merged: 0 };

  const byIdentity = buildIdentityIndex(corpus);
  const events: Event[] = [];
  let inserted = 0;
  let merged = 0;
  let identitySupported = true;

  for (const scraped of scrapedEvents) {
    const payload = scrapedToPayload(scraped, organizerUrls[scraped.sourceUrl]);
    const existing = byIdentity.get(payload.identityKey);
    const snapshot = existing
      ? mergeDiscoveredPayload(eventToSnapshot(existing, payload.identityKey), payload)
      : snapshotFromInsert(payload);

    const enrichment = {
      raw_scrape_data: {
        source_url: scraped.sourceUrl,
        scraped_at: scraped.scrapedAt,
        extracted: scraped.data,
      },
    };

    if (existing) {
      const { data: row, error } = await admin
        .from("events")
        .update(snapshotToRowColumns(snapshot, enrichment))
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) {
        if (isMissingIdentityKeyColumn(error)) {
          identitySupported = false;
          break;
        }
        throw error;
      }
      merged += 1;
      const event = rowToEvent(row as EventRow);
      events.push(event);
      byIdentity.set(payload.identityKey, event);
      continue;
    }

    const { data: row, error } = await admin
      .from("events")
      .insert({
        ...snapshotToRowColumns(snapshot, enrichment),
        is_seed: false,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      if (isMissingIdentityKeyColumn(error)) {
        identitySupported = false;
        break;
      }
      throw error;
    }
    inserted += 1;
    const event = rowToEvent(row as EventRow);
    events.push(event);
    byIdentity.set(payload.identityKey, event);
  }

  if (!identitySupported) {
    return upsertDiscoveredEventsLegacy(admin, scrapedEvents, corpus);
  }

  return { events, inserted, merged };
}

export async function writeDonorSignals(
  admin: SupabaseClient,
  event: Event,
  signals: DonorSignal[],
): Promise<void> {
  const existing = event.donorSignals;
  const fresh = signals.filter(
    (s) => !existing.some((e) => e.filingUrl === s.filingUrl),
  );
  if (fresh.length === 0) return;
  const { error } = await admin
    .from("events")
    .update({ donor_signals: donorSignalsToJson([...existing, ...fresh]) })
    .eq("id", event.id);
  if (error) throw error;
}

export interface MatchWrite {
  eventId: string;
  matchScore: number;
  matchTier: MatchTier;
  whyAttend: string;
  donorSignalCallout?: string;
  evidence: SourcedClaim[];
}

export async function upsertMatches(
  admin: SupabaseClient,
  profileId: string,
  writes: MatchWrite[],
) {
  const verifiedAt = new Date().toISOString();
  const rows = writes.map((w) => ({
    profile_id: profileId,
    event_id: w.eventId,
    match_score: w.matchScore,
    match_tier: w.matchTier,
    why_attend: w.whyAttend,
    donor_signal_callout: w.donorSignalCallout ?? null,
    evidence: evidenceToJson(w.evidence),
    status: "recommended" as const,
    created_at: verifiedAt,
  }));
  let { data, error } = await admin
    .from("event_matches")
    .upsert(rows, { onConflict: "profile_id,event_id" })
    .select("*");
  if (error && isMissingMatchTierColumn(error)) {
    console.warn(
      "[events/store] match_tier column is not applied yet; upserting matches without tier.",
    );
    const legacyRows = writes.map((w) => ({
      profile_id: profileId,
      event_id: w.eventId,
      match_score: w.matchScore,
      why_attend: w.whyAttend,
      donor_signal_callout: w.donorSignalCallout ?? null,
      evidence: evidenceToJson(w.evidence),
      status: "recommended" as const,
      created_at: verifiedAt,
    }));
    const retry = await admin
      .from("event_matches")
      .upsert(legacyRows, { onConflict: "profile_id,event_id" })
      .select("*");
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return ((data ?? []) as EventMatchRow[]).map(rowToEventMatch);
}
