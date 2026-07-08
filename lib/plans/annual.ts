// Budget-capped annual planning data (PRD → "Budget-capped annual planning").
// Assembles the org's matched/saved events into a candidate slate for a
// budget_period, with each entry's CITED registration cost (or "cost
// unverified", excluded from the total) and its labeled travel ESTIMATE.
// Shared by the /plan/annual page, GET /api/plans/annual, and the export route
// so the board and the board-artifact always agree.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Event } from "@/types";
import { rowToEvent, type EventRow } from "@/lib/events/event-row";
import { rowToEventPlan, type EventPlanRow } from "@/lib/plans/plan-row";
import { citedRegistrationCost, type CitedRegistrationCost } from "@/lib/plans/cost";
import { loadPlanProfile, type PlanProfile } from "@/lib/plans/profile";

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

export interface AnnualCandidate {
  event: Event;
  /** Match id — present when the event can be added to the slate from a match. */
  matchId?: string;
  matchScore: number;
  participationTier?: string;
  /** In the slate → the plan row backing it (needed to swap out / edit travel). */
  planId?: string;
  inSlate: boolean;
  /** Cited registration cost, or null when it can't be sourced (excluded from total). */
  registrationCost: CitedRegistrationCost | null;
  /** Travel ESTIMATE (never cited); only meaningful for slate entries. */
  estimatedTravelCost?: number;
}

export interface AnnualPlan {
  orgName: string;
  period?: string;
  annualBudgetCap?: number;
  candidates: AnnualCandidate[];
  /** Sum of cited registration costs across slate entries. */
  citedTotal: number;
  /** Sum of labeled travel estimates across slate entries. */
  travelEstimateTotal: number;
  slateCount: number;
  /** Slate entries whose cost is unverified and therefore excluded from citedTotal. */
  unverifiedInSlate: number;
}

export async function buildAnnualPlan(
  supabase: SupabaseClient,
  profileArg?: PlanProfile | null,
): Promise<AnnualPlan | null> {
  const profile = profileArg ?? (await loadPlanProfile(supabase));
  if (!profile) return null;
  const period = profile.budgetPeriod;

  // Slate = plans grouped under this budget period (null period → ungrouped plans).
  let slateQuery = supabase.from("event_plans").select(PLAN_COLUMNS);
  slateQuery = period ? slateQuery.eq("budget_period", period) : slateQuery.is("budget_period", null);
  const { data: planRows, error: planErr } = await slateQuery;
  if (planErr) throw planErr;
  const slatePlans = (planRows ?? []).map((r) => rowToEventPlan(r as EventPlanRow));

  // Candidate universe = the org's non-dismissed matches (saved + recommended).
  const { data: matchRows, error: matchErr } = await supabase
    .from("event_matches")
    .select("id, event_id, match_score, status")
    .neq("status", "dismissed");
  if (matchErr) throw matchErr;
  const matches = (matchRows ?? []) as {
    id: string;
    event_id: string;
    match_score: number;
    status: string;
  }[];

  const eventIds = [
    ...new Set([...slatePlans.map((p) => p.eventId), ...matches.map((m) => m.event_id)]),
  ];
  const eventsById = new Map<string, Event>();
  if (eventIds.length > 0) {
    const { data: eventRows, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds);
    if (eventErr) throw eventErr;
    for (const row of eventRows ?? []) {
      const event = rowToEvent(row as EventRow);
      eventsById.set(event.id, event);
    }
  }

  const matchByEvent = new Map<string, { id: string; score: number }>();
  for (const m of matches) {
    matchByEvent.set(m.event_id, { id: m.id, score: m.match_score });
  }
  const planByEvent = new Map(slatePlans.map((p) => [p.eventId, p]));

  const candidates: AnnualCandidate[] = [];
  for (const eventId of eventIds) {
    const event = eventsById.get(eventId);
    if (!event) continue;
    const plan = planByEvent.get(eventId);
    const match = matchByEvent.get(eventId);
    const inSlate = !!plan;

    // In-slate entries use the plan's cost SNAPSHOT (authoritative for the total);
    // available entries compute the cited cost live from the event's tiers.
    let registrationCost: CitedRegistrationCost | null;
    if (inSlate) {
      registrationCost =
        plan!.registrationCost != null && plan!.registrationCostSourceUrl && plan!.registrationCostVerifiedAt
          ? {
              amount: plan!.registrationCost,
              sourceUrl: plan!.registrationCostSourceUrl,
              verifiedAt: plan!.registrationCostVerifiedAt,
            }
          : null;
    } else {
      registrationCost = citedRegistrationCost(event, undefined);
    }

    candidates.push({
      event,
      matchId: match?.id,
      matchScore: match?.score ?? 0,
      participationTier: plan?.participationTier,
      planId: plan?.id,
      inSlate,
      registrationCost,
      estimatedTravelCost: plan?.estimatedTravelCost,
    });
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore || a.event.name.localeCompare(b.event.name));

  const slate = candidates.filter((c) => c.inSlate);
  const citedTotal = slate.reduce((sum, c) => sum + (c.registrationCost?.amount ?? 0), 0);
  const travelEstimateTotal = slate.reduce((sum, c) => sum + (c.estimatedTravelCost ?? 0), 0);
  const unverifiedInSlate = slate.filter((c) => c.registrationCost === null).length;

  return {
    orgName: profile.orgName,
    period,
    annualBudgetCap: profile.annualBudgetCap,
    candidates,
    citedTotal,
    travelEstimateTotal,
    slateCount: slate.length,
    unverifiedInSlate,
  };
}
