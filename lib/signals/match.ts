// The event matching orchestrator (docs/NONPROFIT_EVENTS_PRD.md → "Event
// matching pipeline"). One CostMeter threads every stage:
//   PLAN(local) → SEARCH(Tavily, capped) → COMMUNITY(Meetup/Luma) →
//   SCRAPE(Firecrawl, capped) → merge w/ SEED CORPUS → DEDUPE →
//   FILTER(rules) → RANK(local embed) → 990 ENRICH → EXPLAIN(cloud) →
//   VALIDATE(citation-or-no-signal) → RECEIPT.
// Budget caps are hard-stopped upstream; partial results + a stop note beat
// runaway cost. Nothing unsourced survives to a returned match.
import { CostMeter, newRunId } from "@/lib/ai/cost";
import { persistCostEvents } from "@/lib/supabase/costs";
import { collectCitationUrls, toCorpusEvent, FINALIST_CAP, MIN_MATCH_SCORE, type CorpusEvent } from "./schema";
import { planEventQueries, searchEvents } from "./tavily-events";
import { discoverCommunityEvents } from "./meetup";
import { scrapeEventPages, firecrawlConfigured } from "./firecrawl-events";
import { loadSeedCorpus } from "./corpus";
import { dedupeCandidates, isStale } from "./dedupe";
import { filterCandidates } from "./filter";
import { rankCandidates } from "./rank-events";
import { enrichDonorSignals } from "./propublica";
import { explainMatches } from "./explain";
import { persistMatchRun } from "./persist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateEventMatch, validateEventFields } from "@/lib/validate";
import type { Evidence } from "@/lib/data/tavily";
import type {
  EventMatch,
  EventMatchRunResult,
  EventWithRoi,
  NonprofitProfileForMatch,
} from "@/types";

export interface RunEventMatchOptions {
  persist?: boolean;         // write CostEvents to query_costs (default true; no-ops without Supabase)
  scrapeLimit?: number;      // max Tavily URLs handed to Firecrawl (respects the 15-page cap)
  finalistCap?: number;
  minScore?: number;         // floor for a returned match (default MIN_MATCH_SCORE); weak matches are dropped, not padded
}

const DAY = 24 * 60 * 60 * 1000;

/** A Tavily search hit we could not deep-scrape (no Firecrawl) still becomes a
 *  provisional, cited candidate: the query already topically targeted it, and
 *  its URL + snippet are a real citation. Ranking + the explainer judge it. */
function tavilyHitToCandidate(hit: Evidence): CorpusEvent {
  const now = new Date().toISOString();
  const event: EventWithRoi = {
    id: `web_${hit.url}`,
    name: hit.title || hit.url,
    website: hit.url,
    causeAreaTags: [],
    causeSubTags: [],
    isSeed: false,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    certificatesOffered: [],
    scrapeCount: 0,
    createdAt: now,
  };
  return toCorpusEvent(event, hit.snippet, [hit.url]);
}

export async function runEventMatch(
  profile: NonprofitProfileForMatch,
  opts: RunEventMatchOptions = {},
): Promise<EventMatchRunResult> {
  const runId = newRunId();
  const meter = new CostMeter(runId);
  const notices: string[] = [];
  const degraded: string[] = [];
  const budgetStops: string[] = [];
  const finalistCap = opts.finalistCap ?? FINALIST_CAP;

  // Run accumulators, declared up front so finish() can read them from any
  // early return without hitting a temporal-dead-zone on later declarations.
  let consideredCount = 0;
  let finalistsCount = 0;
  let merged = 0;
  let droppedForNoCitation = 0;

  // 1. SEED CORPUS (the moat backbone).
  const seed = await loadSeedCorpus();
  degraded.push(...seed.degraded);

  // 2. PLAN (local).
  const { plan, degraded: planDegraded } = await planEventQueries(meter, profile);
  degraded.push(...planDegraded);

  // 3. SEARCH (Tavily, budget-capped).
  const search = await searchEvents(meter, plan.queries);
  if (search.stoppedAtBudget) budgetStops.push("Tavily budget reached (20 credits) — remaining queries skipped");
  if (search.failedSearches > 0) notices.push(`${search.failedSearches} search(es) failed; discovery may be partial.`);

  // 4. COMMUNITY discovery (Meetup/Luma — no-op + notice when unconfigured).
  const community = await discoverCommunityEvents(meter, profile);
  degraded.push(...community.degraded);

  // 5. SCRAPE (Firecrawl, budget-capped) — new discovery + stale known events.
  //    Staleness governs re-scraping seed rows; without Firecrawl we skip and
  //    note it, matching on the seed corpus (honest degradation).
  const now = Date.now();
  const staleSeedUrls = seed.events.filter((e) => isStale(e.event, now)).map((e) => e.event.website);
  const scrapeTargets = [...search.hits.map((h) => h.url), ...staleSeedUrls].slice(0, opts.scrapeLimit ?? 15);
  const scrape = await scrapeEventPages(meter, scrapeTargets);
  degraded.push(...scrape.degraded);
  if (scrape.stoppedAtBudget) budgetStops.push("Firecrawl budget reached (15 pages) — remaining pages skipped");

  // 6. Assemble candidates from every source, validating nested fields so
  //    nothing unsourced enters the pool.
  const scrapedUrls = new Set(scrape.events.map((e) => e.website));
  const candidates: CorpusEvent[] = [
    ...seed.events,
    ...scrape.events.map((e) => toCorpusEvent(validateEventFields(e))),
    ...community.events.map((e) => toCorpusEvent(validateEventFields(e))),
    // Tavily hits that were NOT deep-scraped become provisional web candidates.
    ...(firecrawlConfigured()
      ? []
      : search.hits.filter((h) => !scrapedUrls.has(h.url)).map(tavilyHitToCandidate)),
  ];

  // 7. DEDUPE (merge live hits into seed rows on domain+name+year).
  const dedupe = dedupeCandidates(candidates);
  merged = dedupe.merged;

  // 8. FILTER (rules — cause overlap + geography, virtual-first-class).
  const { kept, considered } = filterCandidates(profile, dedupe.deduped);
  consideredCount = considered;
  if (kept.length === 0) {
    notices.push("No candidates cleared the cause/geography filter — try broadening cause areas or geography.");
    return finish({ matches: [], events: [] });
  }

  // 9. RANK (local embeddings, fail-open) → finalists.
  const { ranked, degraded: rankDegraded } = await rankCandidates(meter, profile, kept, finalistCap);
  degraded.push(...rankDegraded);
  finalistsCount = ranked.length;

  // 10. 990 ENRICH finalists, then refresh their allowed-citation sets so the
  //     explainer may cite the donor-signal URLs it is shown.
  const { events: enrichedEvents, degraded: ppDegraded } = await enrichDonorSignals(
    meter,
    ranked.map((c) => c.event),
  );
  degraded.push(...ppDegraded);
  const finalists = ranked.map((c, i) => {
    const event = enrichedEvents[i];
    return { ...c, event, citationUrls: collectCitationUrls(event, c.citationUrls) };
  });

  // 11. EXPLAIN (cloud haiku).
  const explainResult = await explainMatches(meter, profile, finalists).catch((err) => {
    console.warn("[match] explanation failed:", err instanceof Error ? err.message : err);
    notices.push("Match explanation unavailable this run (cloud error).");
    return { explanations: [], model: "" };
  });
  const cloudModel = explainResult.model || undefined;
  const byId = new Map(finalists.map((c) => [c.event.id, c]));

  // 12. VALIDATE (citation-or-no-signal) — drop any match without a sourced claim.
  const validatedMatches: EventMatch[] = [];
  for (const exp of explainResult.explanations) {
    const candidate = byId.get(exp.eventId);
    if (!candidate) continue;
    const validated = validateEventMatch({ explanation: exp, candidate, profileId: profile.id });
    if (!validated) {
      droppedForNoCitation += 1;
      continue;
    }
    validatedMatches.push(validated.match);
  }
  if (droppedForNoCitation > 0) {
    notices.push(`${droppedForNoCitation} match(es) dropped for failing citation validation.`);
  }
  if (validatedMatches.length === 0 && explainResult.explanations.length > 0) {
    notices.push("No matches survived citation validation this run.");
  }

  // 12b. THRESHOLD — never pad the feed with weak matches (PRD). Below-floor
  //      matches are dropped honestly; an empty result is an acceptable answer.
  const minScore = opts.minScore ?? MIN_MATCH_SCORE;
  const matches = validatedMatches.filter((m) => m.matchScore >= minScore);
  const belowThreshold = validatedMatches.length - matches.length;
  if (belowThreshold > 0) {
    notices.push(`${belowThreshold} weak match(es) below the score floor (${minScore}) were dropped rather than padding the feed.`);
  }
  if (matches.length === 0 && validatedMatches.length > 0) {
    notices.push("No strong matches this run — try broadening cause areas or geography.");
  }
  const returnedEvents: EventWithRoi[] = matches
    .map((m) => byId.get(m.eventId)?.event)
    .filter((e): e is EventWithRoi => Boolean(e));

  // 13. SORT: match score desc, with an urgency bump for a deadline within 30 days.
  const urgency = (e?: EventWithRoi): number => {
    if (!e) return 0;
    const soon = e.participationTiers.some((t) => {
      if (!t.deadline) return false;
      const dt = new Date(t.deadline).getTime() - now;
      return dt >= 0 && dt <= 30 * DAY;
    });
    return soon ? 1 : 0;
  };
  const eventOf = new Map(returnedEvents.map((e) => [e.id, e]));
  matches.sort((a, b) => {
    const ua = urgency(eventOf.get(a.eventId));
    const ub = urgency(eventOf.get(b.eventId));
    if (ua !== ub) return ub - ua;
    return b.matchScore - a.matchScore;
  });

  // 14. PERSIST the matched events + matches to the shared corpus (service role).
  //     Enriches the events table for every future user and records the matches.
  //     Best-effort: DB errors degrade the run, never lose the result.
  let persisted: { events: number; matches: number } | undefined;
  if (opts.persist !== false && returnedEvents.length > 0) {
    try {
      const admin = createSupabaseAdminClient();
      const pr = await persistMatchRun(admin, {
        profileId: profile.id,
        events: returnedEvents,
        matches,
      });
      persisted = { events: pr.eventsUpserted, matches: pr.matchesUpserted };
      degraded.push(...pr.degraded);
    } catch (err) {
      degraded.push(
        `Supabase persistence skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return finish({ matches, events: returnedEvents, cloudModel, persisted });

  // --- receipt + persistence + meta assembly (shared across early returns) ---
  function finish(args: {
    matches: EventMatch[];
    events: EventWithRoi[];
    cloudModel?: string;
    persisted?: { events: number; matches: number };
  }): EventMatchRunResult {
    const receipt = meter.receipt();
    if (opts.persist !== false) {
      // Best-effort ledger write; never blocks or fails the run (no Supabase → no-op).
      void persistCostEvents({ events: meter.events, runType: "event_match", entityId: profile.id }).catch(
        () => undefined,
      );
    }
    return {
      matches: args.matches,
      events: args.events,
      receipt,
      meta: {
        runId,
        queries: plan.queries,
        candidatesConsidered: consideredCount,
        finalists: finalistsCount,
        matchesReturned: args.matches.length,
        droppedForNoCitation,
        duplicatesMerged: merged,
        budgetStops,
        degraded: [...new Set(degraded)],
        notices,
        cloudModel: args.cloudModel,
        persisted: args.persisted,
      },
    };
  }
}
