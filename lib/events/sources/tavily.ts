// Tavily crawler adapter (ADR-0002). Wraps the existing search stage; host
// exclusions and the credit budget cap live in lib/events/search.ts until PR6
// rewires run.ts to call the router exclusively.
import { CostMeter } from "@/lib/ai/cost";
import type { NonprofitProfile } from "@/types";
import {
  MAX_TAVILY_SEARCHES_PER_RUN,
  searchEventCandidates,
} from "../search";
import type {
  CrawlerSourceCandidate,
  SourceAdapter,
  SourceFetchOutcome,
} from "./types";

export const tavilyAdapter: SourceAdapter = {
  id: "tavily",
  kind: "crawler",

  async fetch(
    _profile: NonprofitProfile,
    queries: string[],
    meter: CostMeter,
  ): Promise<SourceFetchOutcome> {
    if (queries.length === 0) {
      meter.tavily({ stage: "event_search", searches: 0, latencyMs: 0 });
      return { candidates: [], notices: [] };
    }

    const outcome = await searchEventCandidates(meter, queries);
    const candidates: CrawlerSourceCandidate[] = outcome.candidates.map((c) => ({
      kind: "crawler",
      sourceId: "tavily",
      url: c.url,
      title: c.title,
      snippet: c.snippet,
      query: c.query,
    }));

    const notices: string[] = [];
    if (outcome.stoppedAtBudget) {
      notices.push(
        `Tavily search stopped at the ${MAX_TAVILY_SEARCHES_PER_RUN}-credit budget; some planned queries were not run.`,
      );
    }
    if (outcome.searchesFailed > 0) {
      notices.push(
        `${outcome.searchesFailed} of ${outcome.searchesRun + outcome.searchesFailed} Tavily search(es) failed.`,
      );
    }

    return {
      candidates,
      notices,
      stoppedAtBudget: outcome.stoppedAtBudget,
    };
  },
};
