export type CostProvider =
  | "anthropic"
  | "ollama"
  | "tavily"
  | "firecrawl"
  | "propublica"
  | "youtube"
  | "reddit";
export type PipelineStage =
  | "plan"
  | "extract_profile"
  | "extract_voice"
  | "search"
  | "scrape"
  | "rank"
  | "synthesize"
  | "draft"
  // Nonprofit Events pipeline (docs/NONPROFIT_EVENTS_PRD.md)
  | "event_search"
  | "event_scrape"
  | "event_match"
  | "donor_signal";

export interface CostEvent {
  runId: string;
  stage: PipelineStage;
  provider: CostProvider;
  model?: string;            // e.g. "claude-haiku-4-5", "qwen3:8b"
  inputTokens?: number;
  outputTokens?: number;
  unitCount?: number;        // searches, pages, api calls
  usd: number;               // computed from lib/ai/prices.ts
  latencyMs: number;
  createdAt: string;
}

export interface CostReceipt {
  runId: string;
  totalUsd: number;
  byStage: { stage: PipelineStage; provider: CostProvider; usd: number }[];
  localTokenShare: number;   // % of tokens processed at $0 — pitch stat
}
