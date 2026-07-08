// Event-matching orchestrator (ADR-0003): PLAN → SOURCE → FILTER → finalists →
// UNIFORM scrape → ENRICH → EXPLAIN → STORE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CostMeter, newRunId } from "@/lib/ai/cost";
import type { DonorSignal, Event, EventMatch, MatchTier, NonprofitProfile } from "@/types";
import type { CostEvent, CostReceipt } from "@/types/cost";
import { buildCandidatePool } from "./candidates";
import { finalistsToScrape } from "./finalists";
import { planEventQueries } from "./plan";
import { provisionalToScraped, rebuildEventPool } from "./pool";
import { scrapeEventCandidates, MAX_SCRAPE_PAGES_PER_RUN } from "./scrape";
import { enrichDonorSignals } from "./enrich";
import { filterCandidates, scoreEvent, type TieredEvent } from "./filter";
import { explainMatches } from "./explain";
import { eventNeedsScrape } from "./staleness";
import { validateEventFields } from "./validate";
import { fetchSourceCandidates } from "./sources";
import {
  loadEventCorpus,
  upsertDiscoveredEvents,
  upsertMatches,
  writeDonorSignals,
} from "./store";

const FINALIST_COUNT = 12;
const SCRAPE_PAGES_DEFAULT = 5;

export interface EventMatchRunMeta {
  runId: string;
  queries: string[];
  candidatesFound: number;
  pagesScraped: number;
  eventsDiscovered: number;
  eventsMerged: number;
  corpusSize: number;
  finalists: number;
  donorSignalEvents: number;
  cloudModel: string;
  matchesDroppedForNoCitation: number;
  budgetStops: string[];
  deepestTier: MatchTier;
  notices: string[];
}

export interface EventMatchRunResult {
  matches: (EventMatch & { event: Event })[];
  receipt: CostReceipt;
  costEvents: CostEvent[];
  meta: EventMatchRunMeta;
}

function isPast(event: Event, today: string): boolean {
  const last = event.endDate ?? event.startDate;
  return Boolean(last && last < today);
}

function selectFinalists(
  profile: NonprofitProfile,
  tiered: TieredEvent[],
  liveEventIds: Set<string>,
  signalsByEvent: Map<string, DonorSignal[]>,
): TieredEvent[] {
  const scored = tiered
    .map((t) => ({
      t,
      score: scoreEvent(profile, t.event, signalsByEvent.get(t.event.id) ?? [], t.matchTier),
    }))
    .sort((a, b) => b.score - a.score);
  const finalists = scored.slice(0, FINALIST_COUNT).map((f) => f.t);

  const hasLive = finalists.some((f) => liveEventIds.has(f.event.id));
  const bestLive = scored.find((f) => liveEventIds.has(f.t.event.id))?.t;
  if (!hasLive && bestLive) {
    finalists[finalists.length === FINALIST_COUNT ? FINALIST_COUNT - 1 : finalists.length] = bestLive;
  }

  const hasSeed = finalists.some((f) => f.event.isSeed);
  const bestSeed = scored.find((f) => f.t.event.isSeed)?.t;
  if (!hasSeed && bestSeed) {
    finalists[finalists.length === FINALIST_COUNT ? FINALIST_COUNT - 1 : finalists.length] = bestSeed;
  }

  return Array.from(new Map(finalists.map((f) => [f.event.id, f])).values());
}

export async function runEventMatch(
  admin: SupabaseClient,
  profile: NonprofitProfile,
): Promise<EventMatchRunResult> {
  const runId = newRunId();
  const meter = new CostMeter(runId);
  const notices: string[] = [];
  const budgetStops: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  let corpus = await loadEventCorpus(admin);

  let queries: string[] = [];
  try {
    queries = (await planEventQueries(meter, profile)).queries;
  } catch (err) {
    notices.push("Query planning unavailable; matched against the event corpus only.");
    console.warn("[events/run] planning failed:", err instanceof Error ? err.message : err);
  }

  let candidatesFound = 0;
  let organizerUrls: Record<string, string> = {};
  let poolEvents = corpus;
  try {
    const sourced = await fetchSourceCandidates(meter, profile, queries);
    candidatesFound = sourced.candidates.length;
    notices.push(...sourced.notices);
    budgetStops.push(...sourced.budgetStops);
    const pool = buildCandidatePool(corpus, sourced.candidates, profile);
    organizerUrls = pool.organizerUrls;
    poolEvents = pool.events;
  } catch (err) {
    notices.push("Live source discovery unavailable; matched against the event corpus only.");
    console.warn("[events/run] source router failed:", err instanceof Error ? err.message : err);
  }

  let allEvents = poolEvents.map(validateEventFields);
  const preFilter = filterCandidates(profile, allEvents);
  if (preFilter.relaxed) {
    notices.push(
      "Not enough exact matches; results were broadened to related causes or virtual events (labeled by tier).",
    );
  }

  const prelimFinalists = selectFinalists(profile, preFilter.kept, new Set(), new Map());

  const freshStructured = prelimFinalists
    .filter(
      ({ event }) =>
        event.id.startsWith("provisional:") && !eventNeedsScrape(event),
    )
    .map(({ event }) => provisionalToScraped(event));

  let discovered: Event[] = [];
  let inserted = 0;
  let merged = 0;

  if (freshStructured.length > 0) {
    const upserted = await upsertDiscoveredEvents(admin, freshStructured, corpus, organizerUrls);
    discovered.push(...upserted.events);
    inserted += upserted.inserted;
    merged += upserted.merged;
  }

  const scrapeTargets = finalistsToScrape(
    prelimFinalists.map((f) => f.event),
    SCRAPE_PAGES_DEFAULT,
  );
  const scrape = await scrapeEventCandidates(meter, scrapeTargets, SCRAPE_PAGES_DEFAULT);
  if (scrape.skippedReason) notices.push(scrape.skippedReason);
  if (scrape.stoppedAtBudget) {
    const note = `Scraping stopped at the ${MAX_SCRAPE_PAGES_PER_RUN}-page deep-scrape page budget; some finalist pages were not scraped.`;
    budgetStops.push(note);
    notices.push(note);
  }
  if (scrape.pagesFailed > 0) {
    notices.push(`${scrape.pagesFailed} finalist page(s) could not be scraped; results may be partial.`);
  }

  if (scrape.events.length > 0) {
    const upserted = await upsertDiscoveredEvents(admin, scrape.events, corpus, organizerUrls);
    discovered.push(...upserted.events);
    inserted += upserted.inserted;
    merged += upserted.merged;
  }

  corpus = await loadEventCorpus(admin);
  allEvents = rebuildEventPool(corpus, discovered, poolEvents).map(validateEventFields);

  const filtered = filterCandidates(profile, allEvents);
  const refreshedIds = new Set(discovered.map((e) => e.id));
  const finalists = selectFinalists(
    profile,
    filtered.kept.filter((t) => !isPast(t.event, today)),
    refreshedIds,
    new Map(),
  );

  if (finalists.length === 0) {
    notices.push("No upcoming events matched this profile, even with broadened criteria.");
    return {
      matches: [],
      receipt: meter.receipt(),
      costEvents: meter.events,
      meta: {
        runId,
        queries,
        candidatesFound,
        pagesScraped: scrape.pagesScraped,
        eventsDiscovered: inserted,
        eventsMerged: merged,
        corpusSize: allEvents.length,
        finalists: 0,
        donorSignalEvents: 0,
        cloudModel: "",
        matchesDroppedForNoCitation: 0,
        budgetStops,
        deepestTier: filtered.deepestTier,
        notices,
      },
    };
  }

  let signalsByEvent = new Map<string, DonorSignal[]>();
  try {
    const enrichment = await enrichDonorSignals(
      meter,
      finalists.map((f) => f.event),
    );
    signalsByEvent = enrichment.signalsByEvent;
    if (enrichment.lookupsFailed > 0) {
      notices.push("Some donor-signal lookups failed; donor signals may be incomplete.");
    }
  } catch (err) {
    notices.push("Donor-signal enrichment unavailable for this run.");
    console.warn("[events/run] enrichment failed:", err instanceof Error ? err.message : err);
  }

  for (const { event } of finalists) {
    const signals = signalsByEvent.get(event.id);
    if (!signals || signals.length === 0 || event.id.startsWith("provisional:")) continue;
    try {
      await writeDonorSignals(admin, event, signals);
    } catch (err) {
      console.warn("[events/run] donor signal write failed:", err instanceof Error ? err.message : err);
    }
  }

  const withSignals = finalists.map(({ event, matchTier }) => ({
    event,
    matchTier,
    donorSignals: [
      ...event.donorSignals,
      ...(signalsByEvent.get(event.id) ?? []).filter(
        (s) => !event.donorSignals.some((d) => d.filingUrl === s.filingUrl),
      ),
    ],
  }));
  const explained = await explainMatches(meter, profile, withSignals);
  if (explained.evidenceDroppedForBadUrl > 0) {
    notices.push(
      `${explained.evidenceDroppedForBadUrl} evidence claim(s) dropped for failing citation validation.`,
    );
  }

  let matchesDroppedForNoCitation = 0;
  const writes = withSignals.flatMap((f, i) => {
    const explanation = explained.explanations[i];
    if (explanation.evidence.length === 0) {
      matchesDroppedForNoCitation += 1;
      return [];
    }
    if (f.event.id.startsWith("provisional:")) {
      matchesDroppedForNoCitation += 1;
      return [];
    }
    return [
      {
        eventId: f.event.id,
        matchScore: scoreEvent(profile, f.event, f.donorSignals, f.matchTier),
        matchTier: f.matchTier,
        whyAttend: explanation.whyAttend,
        donorSignalCallout: explanation.donorSignalCallout,
        evidence: explanation.evidence,
      },
    ];
  });
  if (matchesDroppedForNoCitation > 0) {
    notices.push(
      `${matchesDroppedForNoCitation} match(es) dropped for having no verifiable citation.`,
    );
  }
  const stored = await upsertMatches(admin, profile.id, writes);

  const eventById = new Map(withSignals.map((f) => [f.event.id, f.event]));
  const matches = stored
    .flatMap((m) => {
      const event = eventById.get(m.eventId);
      return event ? [{ ...m, event }] : [];
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return {
    matches,
    receipt: meter.receipt(),
    costEvents: meter.events,
    meta: {
      runId,
      queries,
      candidatesFound,
      pagesScraped: scrape.pagesScraped,
      eventsDiscovered: inserted,
      eventsMerged: merged,
      corpusSize: allEvents.length,
      finalists: finalists.length,
      donorSignalEvents: signalsByEvent.size,
      cloudModel: explained.model,
      matchesDroppedForNoCitation,
      budgetStops,
      deepestTier: filtered.deepestTier,
      notices,
    },
  };
}
