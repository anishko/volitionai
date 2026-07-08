// Source router (ADR-0002, PR4): structured event APIs first, crawler search
// for the long tail. Each adapter runs under its own budget, emits CostEvents
// (even at $0), and degrades via notices — a dead endpoint never kills the run.
import type { CostMeter } from "@/lib/ai/cost";
import type { NonprofitProfile } from "@/types";
import { eventbriteAdapter } from "./eventbrite";
import { lumaAdapter } from "./luma";
import { meetupAdapter } from "./meetup";
import { tavilyAdapter } from "./tavily";
import type {
  SourceAdapter,
  SourceCandidate,
  SourceFetchOutcome,
  SourceRouterOutcome,
} from "./types";

/** Structured adapters run before crawler adapters (ADR-0002 ordering). */
export const STRUCTURED_ADAPTERS: SourceAdapter[] = [eventbriteAdapter, meetupAdapter, lumaAdapter];
export const CRAWLER_ADAPTERS: SourceAdapter[] = [tavilyAdapter];

function candidateKey(c: SourceCandidate): string {
  const url = c.kind === "structured" ? c.canonicalUrl : c.url;
  return url.toLowerCase().replace(/\/$/, "");
}

/** Structured candidates win over crawler rows for the same URL. */
function dedupeCandidates(candidates: SourceCandidate[]): SourceCandidate[] {
  const byUrl = new Map<string, SourceCandidate>();
  for (const c of candidates) {
    const key = candidateKey(c);
    const existing = byUrl.get(key);
    if (!existing || (existing.kind === "crawler" && c.kind === "structured")) {
      byUrl.set(key, c);
    }
  }
  return [...byUrl.values()];
}

async function safeFetch(
  adapter: SourceAdapter,
  profile: NonprofitProfile,
  queries: string[],
  meter: CostMeter,
): Promise<SourceFetchOutcome> {
  try {
    return await adapter.fetch(profile, queries, meter);
  } catch (err) {
    console.warn(
      `[sources/router] ${adapter.id} fetch failed:`,
      err instanceof Error ? err.message : err,
    );
    return {
      candidates: [],
      notices: [`${adapter.id} source unavailable for this run.`],
    };
  }
}

export async function fetchSourceCandidates(
  meter: CostMeter,
  profile: NonprofitProfile,
  queries: string[],
): Promise<SourceRouterOutcome> {
  const collected: SourceCandidate[] = [];
  const notices: string[] = [];
  const budgetStops: string[] = [];
  const bySource: Record<string, number> = {};
  let structuredCount = 0;
  let crawlerCount = 0;

  for (const adapter of STRUCTURED_ADAPTERS) {
    const outcome = await safeFetch(adapter, profile, queries, meter);
    notices.push(...outcome.notices);
    if (outcome.stoppedAtBudget) {
      budgetStops.push(`${adapter.id} search stopped at its per-run query budget.`);
    }
    for (const c of outcome.candidates) {
      structuredCount += 1;
      bySource[adapter.id] = (bySource[adapter.id] ?? 0) + 1;
      collected.push(c);
    }
  }

  for (const adapter of CRAWLER_ADAPTERS) {
    const outcome = await safeFetch(adapter, profile, queries, meter);
    notices.push(...outcome.notices);
    if (outcome.stoppedAtBudget) {
      budgetStops.push(`${adapter.id} search stopped at its per-run query budget.`);
    }
    for (const c of outcome.candidates) {
      crawlerCount += 1;
      bySource[adapter.id] = (bySource[adapter.id] ?? 0) + 1;
      collected.push(c);
    }
  }

  return {
    candidates: dedupeCandidates(collected),
    notices,
    budgetStops,
    meta: { structuredCount, crawlerCount, bySource },
  };
}
