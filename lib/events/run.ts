// The event-matching orchestrator (issue #4). PLAN → SEARCH → SCRAPE →
// ENRICH (990) → FILTER (rules) → EXPLAIN (cloud) → SCORE + STORE.
// Every stage emits CostEvents into one meter; the caller persists them with
// run_type "event_match". Live stages degrade gracefully: if Tavily or
// Firecrawl is down, seed-corpus matches still come back with a notice.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CostMeter, newRunId } from "@/lib/ai/cost";
import type { DonorSignal, Event, EventMatch, NonprofitProfile } from "@/types";
import type { CostEvent, CostReceipt } from "@/types/cost";
import { planEventQueries } from "./plan";
import { searchEventCandidates, type EventSearchCandidate } from "./search";
import { scrapeEventCandidates } from "./scrape";
import { enrichDonorSignals } from "./enrich";
import { filterCandidates, scoreEvent } from "./filter";
import { explainMatches } from "./explain";
import {
  loadEventCorpus,
  upsertDiscoveredEvents,
  upsertMatches,
  writeDonorSignals,
} from "./store";

// Finalists sent to the cloud explainer (issue: top 10-20).
const FINALIST_COUNT = 12;
// Firecrawl pages per run: default well under the 15-page hard cap
// (docs/DATA_SOURCES.md: "use sparingly, top 3-5 URLs per run").
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
  notices: string[];
}

export interface EventMatchRunResult {
  matches: (EventMatch & { event: Event })[];
  receipt: CostReceipt;
  costEvents: CostEvent[];
  meta: EventMatchRunMeta;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function selectFinalists(
  profile: NonprofitProfile,
  events: Event[],
  liveEventIds: Set<string>,
  signalsByEvent: Map<string, DonorSignal[]>,
): Event[] {
  const scored = events
    .map((event) => ({
      event,
      score: scoreEvent(profile, event, signalsByEvent.get(event.id) ?? []),
    }))
    .sort((a, b) => b.score - a.score);
  const finalists = scored.slice(0, FINALIST_COUNT).map((f) => f.event);

  const hasLive = finalists.some((event) => liveEventIds.has(event.id));
  const bestLive = scored.find((f) => liveEventIds.has(f.event.id))?.event;
  if (!hasLive && bestLive) {
    finalists[finalists.length === FINALIST_COUNT ? FINALIST_COUNT - 1 : finalists.length] = bestLive;
  }

  const hasSeed = finalists.some((event) => event.isSeed);
  const bestSeed = scored.find((f) => f.event.isSeed)?.event;
  if (!hasSeed && bestSeed) {
    finalists[finalists.length === FINALIST_COUNT ? FINALIST_COUNT - 1 : finalists.length] = bestSeed;
  }

  return Array.from(new Map(finalists.map((event) => [event.id, event])).values());
}

export async function runEventMatch(
  admin: SupabaseClient,
  profile: NonprofitProfile,
): Promise<EventMatchRunResult> {
  const runId = newRunId();
  const meter = new CostMeter(runId);
  const notices: string[] = [];

  // Candidate set always starts from the shared corpus (seed + prior finds).
  const corpus = await loadEventCorpus(admin);

  // 1. PLAN (local) — a planner failure only costs us live search, not the run.
  let queries: string[] = [];
  try {
    queries = (await planEventQueries(meter, profile)).queries;
  } catch (err) {
    notices.push("Query planning unavailable; matched against the event corpus only.");
    console.warn("[events/run] planning failed:", err instanceof Error ? err.message : err);
  }

  // 2. SEARCH (Tavily, capped) — same degradation contract.
  let candidates: EventSearchCandidate[] = [];
  if (queries.length > 0) {
    try {
      const search = await searchEventCandidates(meter, queries);
      candidates = search.candidates;
      if (search.searchesFailed > 0) {
        notices.push(
          `${search.searchesFailed} of ${search.searchesRun + search.searchesFailed} live searches failed; results may be partial.`,
        );
      }
    } catch (err) {
      notices.push("Live event search unavailable; matched against the event corpus only.");
      console.warn("[events/run] search failed:", err instanceof Error ? err.message : err);
    }
  } else {
    meter.tavily({ stage: "event_search", searches: 0, latencyMs: 0 });
  }

  // Spend the scrape budget on unknown events first; known domains are
  // already represented in the corpus and only need a staleness refresh.
  const knownDomains = new Set(corpus.map((e) => domainOf(e.website)));
  candidates.sort(
    (a, b) => Number(knownDomains.has(domainOf(a.url))) - Number(knownDomains.has(domainOf(b.url))),
  );

  // 3. SCRAPE (Firecrawl + local extraction, capped).
  const scrape = await scrapeEventCandidates(meter, candidates, SCRAPE_PAGES_DEFAULT);
  if (scrape.skippedReason) notices.push(scrape.skippedReason);
  if (scrape.pagesFailed > 0) {
    notices.push(`${scrape.pagesFailed} event page(s) could not be scraped; results may be partial.`);
  }

  // Store discovered events into the shared corpus (merge-or-insert).
  let discovered: Event[] = [];
  let inserted = 0;
  let merged = 0;
  if (scrape.events.length > 0) {
    const upserted = await upsertDiscoveredEvents(admin, scrape.events, corpus);
    discovered = upserted.events;
    inserted = upserted.inserted;
    merged = upserted.merged;
  }

  // Candidate set = corpus + fresh versions of anything just scraped.
  const refreshedIds = new Set(discovered.map((e) => e.id));
  const allEvents = [...corpus.filter((e) => !refreshedIds.has(e.id)), ...discovered];

  // 4. ENRICH (ProPublica 990) — free API, still metered.
  let signalsByEvent = new Map<string, DonorSignal[]>();
  try {
    const enrichment = await enrichDonorSignals(meter, allEvents);
    signalsByEvent = enrichment.signalsByEvent;
    if (enrichment.lookupsFailed > 0) {
      notices.push("Some donor-signal lookups failed; donor signals may be incomplete.");
    }
  } catch (err) {
    notices.push("Donor-signal enrichment unavailable for this run.");
    console.warn("[events/run] enrichment failed:", err instanceof Error ? err.message : err);
  }

  // Persist fresh donor signals onto the events themselves (acceptance:
  // donor_signals written even where the UI does not yet display them).
  for (const event of allEvents) {
    const signals = signalsByEvent.get(event.id);
    if (!signals || signals.length === 0) continue;
    try {
      await writeDonorSignals(admin, event, signals);
    } catch (err) {
      console.warn("[events/run] donor signal write failed:", err instanceof Error ? err.message : err);
    }
  }

  // 5. FILTER (rules, before any cloud spend).
  const filtered = filterCandidates(profile, allEvents);

  // Preliminary deterministic score picks the finalists.
  const finalists = selectFinalists(profile, filtered.kept, refreshedIds, signalsByEvent);

  if (finalists.length === 0) {
    notices.push("No events matched this profile's cause areas and geography.");
    return {
      matches: [],
      receipt: meter.receipt(),
      costEvents: meter.events,
      meta: {
        runId,
        queries,
        candidatesFound: candidates.length,
        pagesScraped: scrape.pagesScraped,
        eventsDiscovered: inserted,
        eventsMerged: merged,
        corpusSize: allEvents.length,
        finalists: 0,
        donorSignalEvents: signalsByEvent.size,
        cloudModel: "",
        notices,
      },
    };
  }

  // 6. EXPLAIN (cloud, finalists only).
  const withSignals = finalists.map((event) => ({
    event,
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

  // 7. SCORE + STORE.
  const writes = withSignals.map((f, i) => ({
    eventId: f.event.id,
    matchScore: scoreEvent(profile, f.event, f.donorSignals),
    whyAttend: explained.explanations[i].whyAttend,
    donorSignalCallout: explained.explanations[i].donorSignalCallout,
    evidence: explained.explanations[i].evidence,
  }));
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
      candidatesFound: candidates.length,
      pagesScraped: scrape.pagesScraped,
      eventsDiscovered: inserted,
      eventsMerged: merged,
      corpusSize: allEvents.length,
      finalists: finalists.length,
      donorSignalEvents: signalsByEvent.size,
      cloudModel: explained.model,
      notices,
    },
  };
}
