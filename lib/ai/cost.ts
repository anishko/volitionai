// The cost meter. Every provider wrapper records a CostEvent here; the
// orchestrator rolls them into a CostReceipt that the UI prints on the answer.
// This is the "show you the receipt" pillar — do not remove instrumentation.
import { PRICES } from "./prices";
import type { CostEvent, CostReceipt, PipelineStage } from "@/types/cost";

type AnthropicModel = keyof typeof PRICES.anthropic;

export class CostMeter {
  readonly runId: string;
  readonly events: CostEvent[] = [];

  constructor(runId: string) {
    this.runId = runId;
  }

  private push(e: Omit<CostEvent, "runId" | "createdAt">): CostEvent {
    const event: CostEvent = {
      runId: this.runId,
      createdAt: new Date().toISOString(),
      ...e,
    };
    this.events.push(event);
    return event;
  }

  /** Anthropic cloud call — priced per input/output MTok from the price table. */
  anthropic(args: {
    stage: PipelineStage;
    model: AnthropicModel;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  }): CostEvent {
    const price = PRICES.anthropic[args.model];
    const usd =
      (args.inputTokens / 1_000_000) * price.inputPerMTok +
      (args.outputTokens / 1_000_000) * price.outputPerMTok;
    return this.push({
      stage: args.stage,
      provider: "anthropic",
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      usd,
      latencyMs: args.latencyMs,
    });
  }

  /** Ollama local call — $0 marginal, but tokens still counted for the local-share stat. */
  ollama(args: {
    stage: PipelineStage;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  }): CostEvent {
    return this.push({
      stage: args.stage,
      provider: "ollama",
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      usd: 0,
      latencyMs: args.latencyMs,
    });
  }

  /** Tavily search — list price logged even inside the free tier (honest unit economics). */
  tavily(args: { stage: PipelineStage; searches: number; latencyMs: number }): CostEvent {
    return this.push({
      stage: args.stage,
      provider: "tavily",
      unitCount: args.searches,
      usd: args.searches * PRICES.tavily.perBasicSearchUsd,
      latencyMs: args.latencyMs,
    });
  }

  /** Firecrawl deep-scrape — priced per page from the price table. */
  firecrawl(args: { stage: PipelineStage; pages: number; latencyMs: number }): CostEvent {
    return this.push({
      stage: args.stage,
      provider: "firecrawl",
      unitCount: args.pages,
      usd: args.pages * PRICES.firecrawl.perPageUsd,
      latencyMs: args.latencyMs,
    });
  }

  /** ProPublica Nonprofit Explorer — free API, still metered for the audit trail. */
  propublica(args: { stage: PipelineStage; calls: number; latencyMs: number }): CostEvent {
    return this.push({
      stage: args.stage,
      provider: "propublica",
      unitCount: args.calls,
      usd: args.calls * PRICES.propublica.perCallUsd,
      latencyMs: args.latencyMs,
    });
  }

  /** Roll all recorded events into the receipt the UI renders. */
  receipt(): CostReceipt {
    const totalUsd = this.events.reduce((s, e) => s + e.usd, 0);

    const byStage = this.events.map((e) => ({
      stage: e.stage,
      provider: e.provider,
      usd: e.usd,
    }));

    // localTokenShare = % of LLM tokens processed at $0 (Ollama) — the pitch stat.
    let localTokens = 0;
    let totalTokens = 0;
    for (const e of this.events) {
      if (e.provider !== "ollama" && e.provider !== "anthropic") continue;
      const t = (e.inputTokens ?? 0) + (e.outputTokens ?? 0);
      totalTokens += t;
      if (e.provider === "ollama") localTokens += t;
    }
    const localTokenShare =
      totalTokens === 0 ? 0 : Math.round((localTokens / totalTokens) * 100);

    return {
      runId: this.runId,
      totalUsd: round4(totalUsd),
      byStage,
      localTokenShare,
    };
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function newRunId(): string {
  // Not security-sensitive; a readable, unique-enough id for the run.
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
