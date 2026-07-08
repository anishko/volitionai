// PATCH  /api/plans/[id] — update a plan's checklist (complete/uncomplete, add
//   custom tasks) and/or its estimated_travel_cost (an ESTIMATE, never cited).
// DELETE /api/plans/[id] — remove a plan (used to swap an event out of the
//   annual slate). RLS owner policies gate both; no model call, nothing to meter.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanChecklistItem } from "@/types";
import { checklistToJson, rowToEventPlan, type EventPlanRow } from "@/lib/plans/plan-row";

export const runtime = "nodejs";

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

function sanitizeChecklist(raw: unknown): PlanChecklistItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: PlanChecklistItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const task = typeof e.task === "string" ? e.task.trim() : "";
    if (task.length === 0) return null;
    items.push({
      task,
      deadline: typeof e.deadline === "string" ? e.deadline : undefined,
      deadlineSourceUrl:
        typeof e.deadlineSourceUrl === "string" ? e.deadlineSourceUrl : undefined,
      completed: e.completed === true,
      calendarEventId:
        typeof e.calendarEventId === "string" ? e.calendarEventId : undefined,
    });
  }
  return items;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const update: Record<string, unknown> = {};

    if ("checklist" in body) {
      const checklist = sanitizeChecklist(body.checklist);
      if (!checklist) {
        return NextResponse.json(
          { error: "checklist must be an array of { task, completed } items." },
          { status: 400 },
        );
      }
      update.checklist = checklistToJson(checklist);
    }

    if ("estimatedTravelCost" in body) {
      const value = body.estimatedTravelCost;
      if (value === null) {
        update.estimated_travel_cost = null;
      } else if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        update.estimated_travel_cost = value;
      } else {
        return NextResponse.json(
          { error: "estimatedTravelCost must be a non-negative number or null." },
          { status: 400 },
        );
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update (send checklist and/or estimatedTravelCost)." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("event_plans")
      .update(update)
      .eq("id", id)
      .select(PLAN_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    return NextResponse.json({ plan: rowToEventPlan(data as EventPlanRow) });
  } catch (err) {
    console.error("[/api/plans/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update plan." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("event_plans")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: id });
  } catch (err) {
    console.error("[/api/plans/[id] DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete plan." },
      { status: 500 },
    );
  }
}
