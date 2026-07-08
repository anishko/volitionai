// PATCH /api/debriefs/[id] — update a debrief's fields (worth-it, outcome,
//   actual spend, leads, contacts, notes). RLS owner policy gates the write.
//
// There is deliberately NO DELETE handler: debriefs are append-only, matching
// the project's decision to exclude authenticated deletes on grants. If a
// debrief needs to be voided, that's an admin/DB concern, not a user action.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEBRIEF_COLUMNS,
  rowToEventDebrief,
  type EventDebriefRow,
} from "@/lib/debriefs/debrief-row";
import { normalizeDebriefBody } from "@/lib/debriefs/debrief-input";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const { update, error: invalid } = normalizeDebriefBody(body);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        {
          error:
            "Nothing to update (send worthIt, outcome, actualSpendUsd, leadsGained, contactsGained, and/or notes).",
        },
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
      .from("event_debriefs")
      .update(update)
      .eq("id", id)
      .select(DEBRIEF_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Debrief not found." }, { status: 404 });
    }

    return NextResponse.json({ debrief: rowToEventDebrief(data as EventDebriefRow) });
  } catch (err) {
    console.error("[/api/debriefs/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update debrief." },
      { status: 500 },
    );
  }
}
