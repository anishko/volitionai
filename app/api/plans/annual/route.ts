// GET /api/plans/annual — the current budget-capped annual plan for the signed-in
// org: candidate events with cited registration costs (+ labeled travel
// estimates), the running total, and the cap. Swapping events in/out and
// editing travel estimates go through /api/plans and /api/plans/[id]; this route
// is the read model those mutations refresh against.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAnnualPlan } from "@/lib/plans/annual";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const annual = await buildAnnualPlan(supabase);
    if (!annual) {
      return NextResponse.json({ error: "No profile yet." }, { status: 404 });
    }
    return NextResponse.json({ annual });
  } catch (err) {
    console.error("[/api/plans/annual GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load annual plan." },
      { status: 500 },
    );
  }
}
