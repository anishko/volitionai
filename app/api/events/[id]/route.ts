// GET /api/events/[id] — the single-event contract behind the detail page
// (issue #6). Auth-gated; returns 404 for a missing or malformed event id.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadEventById } from "@/lib/events/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const event = await loadEventById(supabase, id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (err) {
    console.error("[/api/events/[id] GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load event." },
      { status: 500 },
    );
  }
}
