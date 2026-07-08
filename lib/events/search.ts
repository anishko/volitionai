// STAGE 2: live event search. Runs the planned queries against Tavily in
// parallel under a hard budget cap (PRD: max 20 credits per match run) and
// returns deduped candidate event URLs. Failure of individual searches
// degrades the run, never kills it — seed events still match.
import { tavilySearch, type Evidence } from "@/lib/data/tavily";
import { CostMeter } from "@/lib/ai/cost";

export const MAX_TAVILY_SEARCHES_PER_RUN = 20;

export interface EventSearchCandidate {
  url: string;
  title: string;
  snippet: string;
  query: string;
}

export interface EventSearchOutcome {
  candidates: EventSearchCandidate[];
  searchesRun: number;
  searchesFailed: number;
  /** True when the Tavily credit ceiling truncated the planned query set —
   *  partial results by design (PRD: "we stopped at budget" beats runaway cost). */
  stoppedAtBudget: boolean;
}

// Domains that list events but are not event pages themselves; scraping them
// yields directory noise instead of one event's speakers/deadlines.
const EXCLUDED_HOSTS = [
  "10times.com",
  "allevents.in",
  "eventbrite.com/d/", // city-level directory pages (individual /e/ pages are fine)
  "facebook.com",
  "linkedin.com",
  "reddit.com",
  "youtube.com",
  "wikipedia.org",
];

function isUsableCandidate(url: string): boolean {
  return !EXCLUDED_HOSTS.some((h) => url.includes(h));
}

export async function searchEventCandidates(
  meter: CostMeter,
  queries: string[],
  resultsPerQuery = 5,
): Promise<EventSearchOutcome> {
  // Hard budget cap (PRD: max 20 Tavily credits per match run). Excess queries
  // are not run — the run degrades to partial results with a logged notice.
  const stoppedAtBudget = queries.length > MAX_TAVILY_SEARCHES_PER_RUN;
  const capped = queries.slice(0, MAX_TAVILY_SEARCHES_PER_RUN);
  const started = Date.now();
  const settled = await Promise.allSettled(
    capped.map((q) => tavilySearch(q, resultsPerQuery)),
  );

  const results: Evidence[] = [];
  let ok = 0;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      ok += 1;
      results.push(...s.value.results);
    }
  }
  meter.tavily({
    stage: "event_search",
    searches: ok,
    latencyMs: Date.now() - started,
  });

  const seen = new Set<string>();
  const candidates: EventSearchCandidate[] = [];
  for (const r of results) {
    const key = r.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key) || !isUsableCandidate(r.url)) continue;
    seen.add(key);
    candidates.push({ url: r.url, title: r.title, snippet: r.snippet, query: r.query });
  }

  return { candidates, searchesRun: ok, searchesFailed: capped.length - ok, stoppedAtBudget };
}
