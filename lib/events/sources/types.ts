// Source-router contracts (ADR-0002, PR4). Structured APIs return pre-filled
// candidates cited to a canonical URL; crawler adapters return URL + snippet for
// the uniform scrape stage (PR6). Every adapter emits CostEvents via the meter.
import type { CostMeter } from "@/lib/ai/cost";
import type { EventFormat, NonprofitProfile } from "@/types";

export type SourceKind = "structured" | "crawler";

/** Pre-filled event from a structured API; fields cite canonicalUrl. */
export interface StructuredSourceCandidate {
  kind: "structured";
  sourceId: string;
  canonicalUrl: string;
  name: string;
  startDate?: string;
  endDate?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: EventFormat;
  /** Classification for cause-filter; profile-derived when the API lacks tags. */
  causeAreaTags: string[];
  organizerUrl?: string;
  description?: string;
  query: string;
}

/** Long-tail page discovered by crawler search; scrape stage fills fields. */
export interface CrawlerSourceCandidate {
  kind: "crawler";
  sourceId: "tavily";
  url: string;
  title: string;
  snippet: string;
  query: string;
}

export type SourceCandidate = StructuredSourceCandidate | CrawlerSourceCandidate;

export interface SourceFetchOutcome {
  candidates: SourceCandidate[];
  notices: string[];
  stoppedAtBudget?: boolean;
}

export interface SourceAdapter {
  readonly id: string;
  readonly kind: SourceKind;
  fetch(
    profile: NonprofitProfile,
    queries: string[],
    meter: CostMeter,
  ): Promise<SourceFetchOutcome>;
}

export interface SourceRouterOutcome {
  candidates: SourceCandidate[];
  notices: string[];
  budgetStops: string[];
  meta: {
    structuredCount: number;
    crawlerCount: number;
    bySource: Record<string, number>;
  };
}

/** Per-adapter query ceilings for a single match run. */
export const EVENTBRITE_MAX_QUERIES_PER_RUN = 5;
export const MEETUP_MAX_TERMS_PER_RUN = 3;
