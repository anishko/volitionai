// GET  /api/plans — list the signed-in user's plans (+ their events).
// POST /api/plans — create a plan from a match_id + participation_tier.
//
// Checklist generation is deterministic (templates + the event's cited tier
// deadlines) so this route makes NO model call and costs $0 — nothing to meter.
// If a future revision drafts checklist copy with a model, meter it via
// query_costs with run_type 'plan'. On create we also snapshot the chosen
// tier's CITED registration cost + the profile's budget_period, so the plan
// flows into /plan/annual (budget-capped annual planning) with a sourced total.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToEvent, type EventRow } from "@/lib/events/event-row";
import { buildChecklist, normalizeTier } from "@/lib/plans/checklist";
import { citedRegistrationCost } from "@/lib/plans/cost";
import {
  checklistToJson,
  rowToEventPlan,
  type EventPlanRow,
} from "@/lib/plans/plan-row";
import { loadPlanProfile } from "@/lib/plans/profile";

export const runtime = "nodejs";

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data: planRows, error } = await supabase
      .from("event_plans")
      .select(PLAN_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const plans = (planRows ?? []).map((r) => rowToEventPlan(r as EventPlanRow));
    const eventIds = [...new Set(plans.map((p) => p.eventId))];
    const eventsById = new Map<string, ReturnType<typeof rowToEvent>>();
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

    return NextResponse.json({
      plans: plans.map((plan) => ({ plan, event: eventsById.get(plan.eventId) ?? null })),
    });
  } catch (err) {
    console.error("[/api/plans GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load plans." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const matchId = typeof body?.matchId === "string" ? body.matchId : undefined;
    const requestedTier =
      typeof body?.participationTier === "string" ? body.participationTier : undefined;
    if (!matchId) {
      return NextResponse.json({ error: "matchId is required." }, { status: 400 });
    }

    // RLS ensures the caller can only read their own match → its profile/event.
    const { data: match, error: matchErr } = await supabase
      .from("event_matches")
      .select("profile_id, event_id")
      .eq("id", matchId)
      .maybeSingle();
    if (matchErr) throw matchErr;
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const { data: eventRow, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", match.event_id)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const event = rowToEvent(eventRow as EventRow);
    const tier = normalizeTier(requestedTier);

    // Idempotent: one plan per (profile, event). Return the existing one if any.
    const { data: existing } = await supabase
      .from("event_plans")
      .select(PLAN_COLUMNS)
      .eq("profile_id", match.profile_id)
      .eq("event_id", match.event_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { plan: rowToEventPlan(existing as EventPlanRow), alreadyExisted: true },
        { status: 200 },
      );
    }

    const checklist = buildChecklist(event, requestedTier);
    const cited = citedRegistrationCost(event, requestedTier);
    const profile = await loadPlanProfile(supabase);

    const insert: Record<string, unknown> = {
      profile_id: match.profile_id,
      event_id: match.event_id,
      participation_tier: tier,
      checklist: checklistToJson(checklist),
      budget_period: profile?.budgetPeriod ?? null,
      registration_cost: cited?.amount ?? null,
      registration_cost_source_url: cited?.sourceUrl ?? null,
      registration_cost_verified_at: cited?.verifiedAt ?? null,
    };

    const { data: row, error: insertErr } = await supabase
      .from("event_plans")
      .insert(insert)
      .select(PLAN_COLUMNS)
      .single();
    if (insertErr) throw insertErr;

    return NextResponse.json({ plan: rowToEventPlan(row as EventPlanRow) }, { status: 201 });
  } catch (err) {
    console.error("[/api/plans POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create plan." },
      { status: 500 },
    );
  }
}
