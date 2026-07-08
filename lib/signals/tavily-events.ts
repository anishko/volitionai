// STAGE: event discovery — query planning (LOCAL qwen3:8b, $0) + a
// budget-capped Tavily executor. The planner turns a NonprofitProfile into
// 6-10 concrete event-discovery queries; the executor runs them until a hard
// ceiling of TAVILY_CREDIT_CAP credits/run, logging the stop on the receipt.
// (docs/NONPROFIT_EVENTS_PRD.md → "Live search" + "Budget caps".)
import { ollamaChat } from "@/lib/ai/ollama";
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import { tavilySearch, type Evidence } from "@/lib/data/tavily";
import {
  EventQueryPlanSchema,
  TAVILY_CREDIT_CAP,
  looseJsonParse,
  todayStr,
  type EventQueryPlan,
} from "./schema";
import type { NonprofitProfileForMatch } from "@/types";

const PLANNER_SYSTEM = `You plan web searches that surface real, cited nonprofit CONFERENCES and EVENTS
where a specific org's next donors, foundations, and issue-area peers gather.
Return ONLY JSON: {"queries": string[]}.
Rules:
- 6-10 queries, each a specific, searchable phrase (not a question).
- Target NAMED events, conferences, summits, convenings, and CFPs — not articles or definitions.
- Build queries from the ISSUE AREAS, event types (conference/summit/convening/CFP), donor/funder
  categories, and geography. DO NOT put the organization's own name in a query — the org is not
  famous, so searching its name finds nothing useful. Search the field it works in, not the org.
- When the org is budget-sensitive, include at least one query for VIRTUAL / online events.
- DATE GROUNDING: bias toward the current and upcoming year; never search for a season already past.`;

function buildPlannerPrompt(p: NonprofitProfileForMatch): string {
  const subtags = p.causeSubTags.length ? p.causeSubTags.join("; ") : "(none — use top-level cause areas)";
  const budgetSensitive = isBudgetSensitive(p);
  return `TODAY'S DATE: ${todayStr()}. Only present/upcoming timeframes.

ORG PROFILE (search its FIELD, never its name):
cause areas: ${p.causeAreas.join("; ")}
cause sub-tags: ${subtags}
geography: ${p.geographyFocus ?? "national"}${p.geographyDetail ? ` — ${p.geographyDetail}` : ""}
donor goals: wants more ${p.targetDonorType.join(", ")} donors; primary goal: ${p.primaryGoal ?? "grow funding"}
budget-sensitive: ${budgetSensitive ? "yes (include virtual/online event queries; certificates/CE credit valued)" : "no"}

Return the JSON query plan now.`;
}

/** Budget sensitivity signal (PRD): low org_size OR a set annual_budget_cap. */
export function isBudgetSensitive(p: NonprofitProfileForMatch): boolean {
  if (typeof p.annualBudgetCap === "number" && p.annualBudgetCap > 0) return true;
  const size = (p.orgSize ?? "").toLowerCase();
  return size.includes("under") || size.includes("500k");
}

/** Plan 6-10 event-discovery queries locally ($0). Falls back to cloud only if
 *  Ollama is unreachable, logging the fallback on the receipt (never silent). */
export async function planEventQueries(
  meter: CostMeter,
  profile: NonprofitProfileForMatch,
): Promise<{ plan: EventQueryPlan; degraded: string[] }> {
  const prompt = buildPlannerPrompt(profile);
  const degraded: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await ollamaChat({ system: PLANNER_SYSTEM, prompt, json: true });
      meter.ollama({
        stage: "event_search",
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        latencyMs: r.latencyMs,
      });
      return { plan: EventQueryPlanSchema.parse(looseJsonParse(r.text)), degraded };
    } catch (err) {
      if (attempt === 1) {
        console.warn(
          "[tavily-events] Ollama query planning failed, falling back to cloud:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  degraded.push("Ollama unavailable — query planning ran on cloud (fallback:cloud)");
  const r = await anthropicMessage({ system: PLANNER_SYSTEM, prompt, maxTokens: 600 });
  meter.anthropic({
    stage: "event_search",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });
  return { plan: EventQueryPlanSchema.parse(looseJsonParse(r.text)), degraded };
}

export interface EventSearchResult {
  hits: Evidence[];          // deduped by URL across all queries that ran
  queriesRun: string[];
  creditsUsed: number;
  stoppedAtBudget: boolean;
  failedSearches: number;
}

/** Execute queries against Tavily, one credit per basic search, hard-stopping
 *  at TAVILY_CREDIT_CAP. Partial results + a stop flag beat runaway cost. */
export async function searchEvents(
  meter: CostMeter,
  queries: string[],
  opts: { maxResultsPerQuery?: number; creditCap?: number } = {},
): Promise<EventSearchResult> {
  const cap = opts.creditCap ?? TAVILY_CREDIT_CAP;
  const perQuery = opts.maxResultsPerQuery ?? 5;

  const byUrl = new Map<string, Evidence>();
  const queriesRun: string[] = [];
  let creditsUsed = 0;
  let failedSearches = 0;
  let stoppedAtBudget = false;
  const started = Date.now();

  for (const q of queries) {
    if (creditsUsed + 1 > cap) {
      stoppedAtBudget = true;
      break;
    }
    creditsUsed += 1; // a basic Tavily search bills one credit whether it succeeds or not
    queriesRun.push(q);
    try {
      const { results } = await tavilySearch(q, perQuery);
      for (const r of results) if (!byUrl.has(r.url)) byUrl.set(r.url, r);
    } catch (err) {
      failedSearches += 1;
      console.warn(
        `[tavily-events] search failed for "${q}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Meter the searches that consumed credits (okSearches billed; failures are
  // logged too so unit economics stay honest — Tavily bills attempts).
  meter.tavily({
    stage: "event_search",
    searches: creditsUsed,
    latencyMs: Date.now() - started,
  });

  return {
    hits: [...byUrl.values()],
    queriesRun,
    creditsUsed,
    stoppedAtBudget,
    failedSearches,
  };
}
