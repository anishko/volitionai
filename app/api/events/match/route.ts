// POST /api/events/match — run the matching pipeline; enforce budget caps;
// return matches + the events they point at + the per-run cost receipt
// (docs/NONPROFIT_EVENTS_PRD.md → API routes). Auth/profile ownership wiring is
// intentionally thin here: the profile is resolved via the single adapter seam
// (loadProfileForMatch), falling back to the demo TEST_PROFILE when no profile
// is available — clearly flagged in the response so nothing is silently mocked.
import { NextResponse } from "next/server";
import { runEventMatch } from "@/lib/signals/match";
import { loadProfileForMatch } from "@/lib/signals/profile-adapter";
import { TEST_PROFILE } from "@/lib/signals/schema";
import type { NonprofitProfileForMatch } from "@/types";

export const runtime = "nodejs";        // needs fs (seed corpus) + server-only keys
export const maxDuration = 120;

interface MatchRequestBody {
  profileId?: string;
  profile?: NonprofitProfileForMatch;
  options?: { scrapeLimit?: number; finalistCap?: number; persist?: boolean };
}

export async function POST(req: Request) {
  let body: MatchRequestBody = {};
  try {
    body = (await req.json()) as MatchRequestBody;
  } catch {
    /* empty body is allowed — falls through to the demo profile */
  }

  let profile: NonprofitProfileForMatch | null = body.profile ?? null;
  let usingDemoProfile = false;
  if (!profile && body.profileId) profile = await loadProfileForMatch(body.profileId);
  if (!profile) {
    profile = TEST_PROFILE;
    usingDemoProfile = true;
  }

  try {
    const result = await runEventMatch(profile, body.options ?? {});
    if (usingDemoProfile) {
      result.meta.notices.unshift("No stored profile resolved — ran against the demo TEST_PROFILE.");
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/events/match] run failed:", err);
    return NextResponse.json(
      { error: "Match run failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
