// POST /api/events/match — run issue #4's nonprofit event matcher for the
// caller's profile, persist the generated matches, and write the CostEvents
// ledger with run_type="event_match" and entity_id=profile_id.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistCostEvents } from "@/lib/supabase/costs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { runEventMatch } from "@/lib/events/run";

export const runtime = "nodejs";
export const maxDuration = 180;

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
    const profileId = typeof body?.profileId === "string" ? body.profileId : undefined;

    let query = supabase
      .from("nonprofit_profiles")
      .select("*")
      .eq("user_id", user.id);
    query = profileId ? query.eq("id", profileId) : query;

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: profileId ? "Profile not found." : "No profile yet." },
        { status: 404 },
      );
    }

    const profile = rowToNonprofitProfile(data as NonprofitProfileRow);
    const result = await runEventMatch(createSupabaseAdminClient(), profile);
    const { costEvents, ...response } = result;
    const { persisted } = await persistCostEvents({
      events: costEvents,
      runType: "event_match",
      entityId: profile.id,
    });

    return NextResponse.json({
      ...response,
      cached: false,
      costsPersisted: persisted,
    });
  } catch (err) {
    console.error("[/api/events/match POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Event matching failed." },
      { status: 500 },
    );
  }
}
