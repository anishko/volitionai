// The pipeline orchestrator. PLAN → FETCH → RANK → SYNTHESIZE → VALIDATE → METER.
// Every stage emits CostEvents into one meter; the run returns the cards plus
// the receipt the UI prints on the answer.
import { CostMeter, newRunId } from "@/lib/ai/cost";
import { tavilySearch, type Evidence } from "@/lib/data/tavily";
import { propublicaSearch, orgToEvidence } from "@/lib/data/propublica";
import { eventbriteSearch, eventToEvidence } from "@/lib/data/eventbrite";
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

  // 2. FETCH — Tavily (all queries) + Eventbrite (event lane) + ProPublica (donor/comparable lanes)
  const runEventbrite = plan.lanes.includes("event");
  const runProPublica = plan.lanes.includes("donor") || plan.lanes.includes("comparable");
  // Use first 3 queries for specialized sources — they're highest-signal from the planner.
  const specialistQueries = plan.queries.slice(0, 3);

  const fetchStart = Date.now();
  const [tavilySettled, eventbriteSettled, proPublicaSettled] = await Promise.all([
    Promise.allSettled(plan.queries.map((q) => tavilySearch(q, 5))),
    runEventbrite
      ? Promise.allSettled(specialistQueries.map((q) => eventbriteSearch(q, 5)))
      : Promise.resolve([] as PromiseSettledResult<Awaited<ReturnType<typeof eventbriteSearch>>>[]),
    runProPublica
      ? Promise.allSettled(specialistQueries.map((q) => propublicaSearch(q, 5)))
      : Promise.resolve([] as PromiseSettledResult<Awaited<ReturnType<typeof propublicaSearch>>>[]),
  ]);

  const evidence: Evidence[] = [];

  // Tavily results
  let okTavily = 0;
  for (const s of tavilySettled) {
    if (s.status === "fulfilled") { okTavily += 1; evidence.push(...s.value.results); }
  }
  meter.tavily({ stage: "search", searches: okTavily, latencyMs: Date.now() - fetchStart });
  if (okTavily < plan.queries.length) {
    notices.push(`${plan.queries.length - okTavily} of ${plan.queries.length} Tavily searches failed.`);
  }

  // Eventbrite results
  if (runEventbrite) {
    const ebStart = Date.now();
    let okEb = 0;
    for (const s of eventbriteSettled) {
      if (s.status === "fulfilled") {
        okEb += 1;
        for (const ev of s.value.events) {
          const e = eventToEvidence(ev);
          if (e) evidence.push(e);
        }
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        if (msg.includes("EVENTBRITE_API_KEY")) {
          notices.push("Eventbrite event discovery skipped (EVENTBRITE_API_KEY not set).");
          break;
        }
      }
    }
    if (okEb > 0) meter.eventbrite({ stage: "search", calls: okEb, latencyMs: Date.now() - ebStart });
  }

  // ProPublica results
  if (runProPublica) {
    const ppStart = Date.now();
    let okPp = 0;
    for (const [i, s] of proPublicaSettled.entries()) {
      if (s.status === "fulfilled") {
        okPp += 1;
        const q = specialistQueries[i] ?? "";
        for (const org of s.value.orgs) evidence.push(orgToEvidence(org, q));
      }
    }
    if (okPp > 0) meter.propublica({ stage: "search", calls: okPp, latencyMs: Date.now() - ppStart });
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
