import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToEventMatch, type EventMatchRow } from "@/lib/events/event-row";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = body?.status;

    if (status !== "saved" && status !== "dismissed") {
      return NextResponse.json(
        { error: "Status must be saved or dismissed." },
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
      .from("event_matches")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    return NextResponse.json({ match: rowToEventMatch(data as EventMatchRow) });
  } catch (err) {
    console.error("[/api/matches/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update match." },
      { status: 500 },
    );
  }
}
