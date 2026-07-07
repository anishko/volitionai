// The pipeline orchestrator. PLAN → FETCH → RANK → SYNTHESIZE → VALIDATE → METER.
// Every stage emits CostEvents into one meter; the run returns the cards plus
// the receipt the UI prints on the answer.
import { CostMeter, newRunId } from "@/lib/ai/cost";
import { tavilySearch, type Evidence } from "@/lib/data/tavily";
import { extractProfile } from "./profile";
import { planQueries } from "./plan";
import { rankEvidence } from "./rank";
import { synthesize } from "./synthesize";
import { validateCards } from "./validate";
import type { BusinessProfile, IdeaCard } from "@/types";
import type { CostReceipt } from "@/types/cost";

export interface RunMeta {
  runId: string;
  queries: string[];
  lanes: string[];
  evidenceFetched: number;
  evidenceRanked: number;
  droppedForNoCitation: number;
  cloudModel: string;
  notices: string[]; // honest "some lanes unavailable" style messages
  capturedAt?: string; // set when persisted as a fixture
}

export interface IdeasRunResult {
  profile: BusinessProfile;
  cards: IdeaCard[];
  receipt: CostReceipt;
  meta: RunMeta;
}

export interface ProfileRunResult {
  profile: BusinessProfile;
  receipt: CostReceipt;
  runId: string;
}

/** /api/profile — LOCAL extraction, typically $0. */
export async function runProfile(
  description: string,
  pastContent?: string,
): Promise<ProfileRunResult> {
  const runId = newRunId();
  const meter = new CostMeter(runId);
  const profile = await extractProfile(runId, meter, description, pastContent);
  return { profile, receipt: meter.receipt(), runId };
}

/** /api/ideas — the full research run over a known profile. */
export async function runIdeas(profile: BusinessProfile): Promise<IdeasRunResult> {
  const runId = newRunId();
  const meter = new CostMeter(runId);
  const notices: string[] = [];

  // 1. PLAN (local)
  const plan = await planQueries(meter, profile);

  // 2. FETCH (parallel Tavily search)
  const fetchStart = Date.now();
  const settled = await Promise.allSettled(
    plan.queries.map((q) => tavilySearch(q, 5)),
  );
  const evidence: Evidence[] = [];
  let okSearches = 0;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      okSearches += 1;
      evidence.push(...s.value.results);
    }
  }
  meter.tavily({
    stage: "search",
    searches: okSearches,
    latencyMs: Date.now() - fetchStart,
  });
  if (okSearches < plan.queries.length) {
    notices.push(
      `${plan.queries.length - okSearches} of ${plan.queries.length} searches failed; results may be partial.`,
    );
  }
  if (evidence.length === 0) {
    throw new Error(
      "No evidence could be fetched (search unavailable). Cannot produce cited cards.",
    );
  }

  // 3. RANK (local embeddings, fail-open)
  const ranked = await rankEvidence(meter, profile, evidence, 12);

  // 4. SYNTHESIZE (cloud, strict citations)
  const { cards: coreCards, model: cloudModel } = await synthesize(
    meter,
    profile,
    ranked,
    plan.lanes,
  );

  // 5. VALIDATE (mechanical citation enforcement)
  const { cards, droppedForNoCitation } = validateCards(coreCards, ranked);
  if (droppedForNoCitation > 0) {
    notices.push(
      `${droppedForNoCitation} draft card(s) dropped for failing citation validation.`,
    );
  }
  if (cards.length === 0) {
    notices.push("No cards survived citation validation for this run.");
  }

  // 6. METER
  return {
    profile,
    cards,
    receipt: meter.receipt(),
    meta: {
      runId,
      queries: plan.queries,
      lanes: plan.lanes,
      evidenceFetched: evidence.length,
      evidenceRanked: ranked.length,
      droppedForNoCitation,
      cloudModel,
      notices,
    },
  };
}
