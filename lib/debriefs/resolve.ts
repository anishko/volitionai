// Resolving the debrief's target plan. A debrief hangs off an event_plan
// (event_debriefs.plan_id, NOT NULL), but the UI is keyed by matchId, so we
// resolve match → (profile_id, event_id) → event_plan exactly the way
// /api/plans does. RLS scopes every read to the signed-in owner, so a match or
// plan that isn't theirs simply doesn't resolve. We reuse lib/plans' row mapper
// so the PLANNED (sourced) budget figures come back in one shape.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  rowToEventPlan,
  type EventPlanRow,
  type EventPlanFull,
} from "@/lib/plans/plan-row";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

export interface PlanResolution {
  /** The plan for this match, or null if the event isn't in the user's plan. */
  plan: EventPlanFull | null;
  /** false → matchId didn't resolve to a match the caller owns. */
  matchFound: boolean;
  /** The match's event id — lets the no-plan UI link to the add-to-plan flow. */
  eventId: string | null;
}

export async function resolvePlanForMatch(
  supabase: ServerClient,
  matchId: string,
): Promise<PlanResolution> {
  const { data: match, error: matchErr } = await supabase
    .from("event_matches")
    .select("profile_id, event_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) throw matchErr;
  if (!match) return { plan: null, matchFound: false, eventId: null };

  const { data: planRow, error: planErr } = await supabase
    .from("event_plans")
    .select(PLAN_COLUMNS)
    .eq("profile_id", match.profile_id)
    .eq("event_id", match.event_id)
    .maybeSingle();
  if (planErr) throw planErr;

  return {
    plan: planRow ? rowToEventPlan(planRow as EventPlanRow) : null,
    matchFound: true,
    eventId: match.event_id,
  };
}

export async function loadPlanById(
  supabase: ServerClient,
  planId: string,
): Promise<EventPlanFull | null> {
  const { data, error } = await supabase
    .from("event_plans")
    .select(PLAN_COLUMNS)
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEventPlan(data as EventPlanRow) : null;
}
