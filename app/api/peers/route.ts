import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { CostMeter, newRunId } from "@/lib/ai/cost";
import { analyzePeers } from "@/lib/peers/analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { profileId } = await req.json();
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { data: row, error } = await supabase
      .from("nonprofit_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const profile = rowToNonprofitProfile(row as NonprofitProfileRow);
    const meter = new CostMeter(newRunId());
    const peers = await analyzePeers(meter, profile);

    return NextResponse.json({ peers, receipt: meter.receipt() });
  } catch (err) {
    console.error("[/api/peers POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Peer analysis failed." },
      { status: 500 },
    );
  }
}
