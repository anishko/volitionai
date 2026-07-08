// POST /api/outreach — generate an outreach draft for a match + draft_type,
// LOCALLY in the org's voice ($0), grounded in the match's cited claims. The AI
// prepares; the human sends. Nothing is ever sent by the system.
// Body: { matchId: uuid, draftType: "sponsor_pitch" | "cfp_abstract" | "intro_email" }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CostMeter, newRunId } from "@/lib/ai/cost";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistCostEvents } from "@/lib/supabase/costs";
import { rowToEventMatch, rowToEvent, type EventMatchRow, type EventRow } from "@/lib/events/event-row";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { draftOutreach } from "@/lib/outreach/draft";
import { persistOutreachDraft } from "@/lib/outreach/store";
import type { OutreachDraft } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  matchId: z.string().uuid(),
  draftType: z.enum(["sponsor_pitch", "cfp_abstract", "intro_email"]),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Expected { matchId, draftType }." }, { status: 400 });
    }
    const { matchId, draftType } = parsed.data;

    // Owner-scoped by RLS: the user client only sees the caller's own match.
    const { data: matchRow, error: matchErr } = await supabase
      .from("event_matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();
    if (matchErr) throw matchErr;
    if (!matchRow) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const match = rowToEventMatch(matchRow as EventMatchRow);

    const { data: profileRow } = await supabase
      .from("nonprofit_profiles")
      .select("*")
      .eq("id", match.profileId)
      .maybeSingle();
    if (!profileRow) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const profile = rowToNonprofitProfile(profileRow as NonprofitProfileRow);

    const { data: eventRow } = await supabase
      .from("events")
      .select("*")
      .eq("id", match.eventId)
      .maybeSingle();
    const event = eventRow ? rowToEvent(eventRow as EventRow) : null;

    // DRAFT (local, metered).
    const meter = new CostMeter(newRunId());
    const result = await draftOutreach(meter, { profile, match, event, draftType });

    // Persist the draft (service role) + the cost ledger. Both best-effort.
    const admin = createSupabaseAdminClient();
    const saved = await persistOutreachDraft(admin, {
      matchId,
      draftType,
      body: result.body,
      evidence: result.evidence,
      modelRoute: result.modelRoute,
    });
    const { persisted: costsPersisted } = await persistCostEvents({
      events: meter.events,
      runType: "outreach_draft",
      entityId: profile.id,
    });

    const draft: OutreachDraft =
      saved ?? {
        id: "unsaved",
        matchId,
        draftType,
        body: result.body,
        evidence: result.evidence,
        modelRoute: result.modelRoute,
        createdAt: new Date().toISOString(),
      };

    return NextResponse.json({ draft, receipt: meter.receipt(), costsPersisted });
  } catch (err) {
    console.error("[/api/outreach POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft failed." },
      { status: 500 },
    );
  }
}
