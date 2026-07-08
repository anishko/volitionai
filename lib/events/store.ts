// STAGE 7: persistence. Server-side only (service role): the events corpus
// and event_matches have no client write policies by design. Live-discovered
// events are merged into the shared corpus — every scrape any user triggers
// enriches the table for every future user (the moat).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DonorSignal, Event, MatchTier, SourcedClaim } from "@/types";
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

/**
 * Single event by id for the detail page (issue #6). Pass a user-scoped
 * client so the "authenticated read" RLS policy applies. Returns null for a
 * missing row or a malformed id, which the caller renders as a 404.
 */
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
    // 22P02 = invalid uuid text; treat unparseable ids as "not found".
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? rowToEvent(data as EventRow) : null;
}

function normalizedDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

// PRD dedupe rule: normalized domain + name similarity. A live-search hit
// matching a seed row merges into it rather than duplicating.
function isSameEvent(scraped: ScrapedEvent, existing: Event): boolean {
  if (normalizedDomain(scraped.sourceUrl) !== normalizedDomain(existing.website)) {
    return false;
  }
  const a = nameTokens(scraped.data.name);
  const b = nameTokens(existing.name);
  if (a.size === 0 || b.size === 0) return true; // same domain, unusable names
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.min(a.size, b.size) >= 0.5;
}

/** Enrichment-owned column payload from one scraped page (source URLs stamped). */
function scrapedEnrichmentColumns(scraped: ScrapedEvent) {
  const { data, sourceUrl, scrapedAt } = scraped;
  return {
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
}

export interface UpsertEventsOutcome {
  events: Event[]; // fresh rows for every scraped event (merged or inserted)
  inserted: number;
  merged: number;
}

export async function upsertDiscoveredEvents(
  admin: SupabaseClient,
  scrapedEvents: ScrapedEvent[],
  corpus: Event[],
): Promise<UpsertEventsOutcome> {
  const events: Event[] = [];
  let inserted = 0;
  let merged = 0;

  for (const scraped of scrapedEvents) {
    const existing = corpus.find((e) => isSameEvent(scraped, e));
    const enrichment = scrapedEnrichmentColumns(scraped);

    if (existing) {
      // Merge: enrichment-owned columns are replaced; curation-owned fields
      // (name, dates, location, format) are only filled where still unknown.
      const { data: row, error } = await admin
        .from("events")
        .update({
          ...enrichment,
          start_date: existing.startDate ?? scraped.data.startDate ?? null,
          end_date: existing.endDate ?? scraped.data.endDate ?? null,
          location_city: existing.locationCity ?? scraped.data.locationCity ?? null,
          location_state: existing.locationState ?? scraped.data.locationState ?? null,
          location_country: existing.locationCountry ?? scraped.data.locationCountry ?? null,
          format: existing.format ?? scraped.data.format ?? null,
          cause_area_tags: Array.from(
            new Set([...existing.causeAreaTags, ...scraped.data.causeAreaTags]),
          ),
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
        name: scraped.data.name,
        website: scraped.sourceUrl,
        start_date: scraped.data.startDate ?? null,
        end_date: scraped.data.endDate ?? null,
        location_city: scraped.data.locationCity ?? null,
        location_state: scraped.data.locationState ?? null,
        location_country: scraped.data.locationCountry ?? null,
        format: scraped.data.format ?? null,
        cause_area_tags: scraped.data.causeAreaTags,
        is_seed: false,
        ...enrichment,
      })
      .select("*")
      .single();
    if (error) {
      // 23505 = another run inserted the same event concurrently; skip quietly.
      if (error.code === "23505") continue;
      throw error;
    }
    inserted += 1;
    events.push(rowToEvent(row as EventRow));
  }

  return { events, inserted, merged };
}

/** Merge newly found donor signals onto the event record (dedupe by filing URL). */
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
  // created_at doubles as the match's verified_at stamp: the moment its
  // evidence passed citation validation. Set explicitly (not left to the DB
  // default) so a re-run re-stamps the verification time.
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
  const { data, error } = await admin
    .from("event_matches")
    .upsert(rows, { onConflict: "profile_id,event_id" })
    .select("*");
  if (error) throw error;
  return ((data ?? []) as EventMatchRow[]).map(rowToEventMatch);
}
