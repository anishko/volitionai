// GET  /api/debriefs?matchId=… (or ?planId=…) — the debrief for an event plan,
//   plus the PLANNED figures to compare against (planned-vs-actual). matchId is
//   the primary key the UI uses; it resolves to the event's plan.
// POST /api/debriefs — create a debrief for a match's plan. Idempotent: one
//   debrief per plan, so a repeat returns the existing one. Updates go through
//   PATCH /api/debriefs/[id]. No DELETE endpoint — debriefs are append-only by
//   design (mirrors the grants decision to exclude authenticated deletes).
//
// The debrief captures the org's OWN reported numbers (actual spend, leads,
// contacts, attend/skip, worth-it, notes) — user input, so uncited. The sourced
// PLANNED side rides on the plan (registration_cost + its source_url). No model
// call here, so nothing to meter.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEBRIEF_COLUMNS,
  rowToEventDebrief,
  type EventDebriefRow,
} from "@/lib/debriefs/debrief-row";
import { normalizeDebriefBody } from "@/lib/debriefs/debrief-input";
import { loadPlanById, resolvePlanForMatch } from "@/lib/debriefs/resolve";

export const runtime = "nodejs";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Latest debrief for a plan (one per plan by convention; guard just in case). */
async function debriefForPlan(supabase: ServerClient, planId: string) {
  const { data, error } = await supabase
    .from("event_debriefs")
    .select(DEBRIEF_COLUMNS)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEventDebrief(data as EventDebriefRow) : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const url = new URL(req.url);
    const matchId = url.searchParams.get("matchId") ?? undefined;
    const planId = url.searchParams.get("planId") ?? undefined;

    if (planId) {
      const plan = await loadPlanById(supabase, planId);
      if (!plan) {
        return NextResponse.json({ error: "Plan not found." }, { status: 404 });
      }
      const debrief = await debriefForPlan(supabase, plan.id);
      return NextResponse.json({ plan, debrief, planExists: true });
    }

    if (matchId) {
      const { plan, matchFound } = await resolvePlanForMatch(supabase, matchId);
      if (!matchFound) {
        return NextResponse.json({ error: "Match not found." }, { status: 404 });
      }
      // Event isn't in the plan yet → no debrief is possible (FK requires a
      // plan). UI renders an "add this event to your plan first" state.
      if (!plan) {
        return NextResponse.json({ plan: null, debrief: null, planExists: false });
      }
      const debrief = await debriefForPlan(supabase, plan.id);
      return NextResponse.json({ plan, debrief, planExists: true });
    }

    return NextResponse.json({ error: "matchId or planId is required." }, { status: 400 });
  } catch (err) {
    console.error("[/api/debriefs GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load debrief." },
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const matchId = typeof body.matchId === "string" ? body.matchId : undefined;
    const bodyPlanId = typeof body.planId === "string" ? body.planId : undefined;

    // Resolve the target plan. A debrief cannot exist without a plan (FK).
    let planId: string | undefined;
    if (bodyPlanId) {
      const plan = await loadPlanById(supabase, bodyPlanId);
      if (!plan) {
        return NextResponse.json({ error: "Plan not found." }, { status: 404 });
      }
      planId = plan.id;
    } else if (matchId) {
      const { plan, matchFound } = await resolvePlanForMatch(supabase, matchId);
      if (!matchFound) {
        return NextResponse.json({ error: "Match not found." }, { status: 404 });
      }
      if (!plan) {
        return NextResponse.json(
          {
            error: "Add this event to your plan before writing a debrief.",
            needsPlan: true,
          },
          { status: 409 },
        );
      }
      planId = plan.id;
    } else {
      return NextResponse.json({ error: "matchId or planId is required." }, { status: 400 });
    }

    const { update, error: invalid } = normalizeDebriefBody(body);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    // Idempotent: one debrief per plan. Return the existing one untouched.
    const existing = await debriefForPlan(supabase, planId);
    if (existing) {
      return NextResponse.json({ debrief: existing, alreadyExisted: true }, { status: 200 });
    }

    // Insert through the user-scoped client so the RLS owner policy (plan →
    // profile → auth.uid()) gates the write.
    const { data: row, error: insertErr } = await supabase
      .from("event_debriefs")
      .insert({ plan_id: planId, ...update })
      .select(DEBRIEF_COLUMNS)
      .single();
    if (insertErr) throw insertErr;

    return NextResponse.json(
      { debrief: rowToEventDebrief(row as EventDebriefRow) },
      { status: 201 },
    );
  } catch (err) {
    console.error("[/api/debriefs POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create debrief." },
      { status: 500 },
    );
  }
}
