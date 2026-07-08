import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googleOAuthOptions } from "@/lib/auth/google";
import {
  pendingSyncItems,
  buildCalendarEventBody,
  createCalendarEvent,
} from "@/lib/calendar/sync";
import { checklistToJson, rowToEventPlan, type EventPlanRow } from "@/lib/plans/plan-row";
import type { PlanChecklistItem } from "@/types";

export const runtime = "nodejs";

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

export async function POST(
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

    const { data: planRow, error: planErr } = await supabase
      .from("event_plans")
      .select(PLAN_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!planRow) {
      return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    }

    const plan = rowToEventPlan(planRow as EventPlanRow);

    const { data: eventRow, error: eventErr } = await supabase
      .from("events")
      .select("name")
      .eq("id", plan.eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    const eventName = (eventRow as { name: string } | null)?.name ?? "Event";

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (!providerToken) {
      const oauthOptions = googleOAuthOptions({
        requestCalendarScope: true,
        redirectTo: (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/plan",
      });
      return NextResponse.json(
        { needsCalendarAuth: true, oauthOptions },
        { status: 403 },
      );
    }

    const pending = pendingSyncItems(plan.checklist);

    let synced = 0;
    let failed = 0;
    const updatedChecklist: PlanChecklistItem[] = [...plan.checklist];

    for (const item of pending) {
      const idx = updatedChecklist.findIndex(
        (c) => c.task === item.task && c.deadline === item.deadline,
      );
      try {
        const calendarEventId = await createCalendarEvent(
          providerToken,
          buildCalendarEventBody(item, {
            eventName,
            tier: plan.participationTier ?? "attending",
          }),
        );
        if (idx !== -1) {
          updatedChecklist[idx] = { ...updatedChecklist[idx], calendarEventId };
        }
        synced++;
      } catch (err) {
        console.error("[/api/plans/[id]/calendar POST] failed to sync item", item.task, err);
        failed++;
      }
    }

    const skipped = plan.checklist.length - pending.length;

    const { data: updated, error: updateErr } = await supabase
      .from("event_plans")
      .update({
        checklist: checklistToJson(updatedChecklist),
        calendar_synced_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(PLAN_COLUMNS)
      .maybeSingle();
    if (updateErr) throw updateErr;

    return NextResponse.json({
      plan: updated ? rowToEventPlan(updated as EventPlanRow) : plan,
      synced,
      skipped,
      failed,
    });
  } catch (err) {
    console.error("[/api/plans/[id]/calendar POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync calendar." },
      { status: 500 },
    );
  }
}
