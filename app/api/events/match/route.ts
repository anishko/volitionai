// POST /api/events/match — run the live event matcher for the caller's
// profile with match_runs tracking (ADR-0005): the run is visible, its
// failure is visible, and the feed can retry. GET — poll the latest run
// state + current feed items (drives the live-search banner).
// Demo insurance envs:
//   DEMO_FALLBACK=1          → POST/GET serve captured fixture; never touches network
//   CAPTURE_EVENT_FIXTURE=1  → successful live POST writes fixture to fixtures/events/<slug>.json
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { loadEventFeed } from "@/lib/events/feed";
import { createMatchRun, latestMatchRun, runLiveMatchTracked } from "@/lib/events/runs";
import {
  captureEventFixture,
  defaultEventFixture,
  loadEventFixture,
  slugifyPersona,
} from "@/lib/events/fixtures";

export const runtime = "nodejs";
export const maxDuration = 180;

async function loadProfile(profileId?: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null, unauthorized: true as const };

  let query = supabase.from("nonprofit_profiles").select("*").eq("user_id", user.id);
  query = profileId ? query.eq("id", profileId) : query;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return {
    supabase,
    profile: data ? rowToNonprofitProfile(data as NonprofitProfileRow) : null,
    unauthorized: false as const,
  };
}

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId") ?? undefined;
    const { supabase, profile, unauthorized } = await loadProfile(profileId);
    if (unauthorized) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    if (!profile) {
      return NextResponse.json({ error: "No profile yet." }, { status: 404 });
    }

    // Demo fallback: serve fixture so polling resolves immediately as "done".
    if (process.env.DEMO_FALLBACK === "1") {
      const fixture =
        loadEventFixture(slugifyPersona(profile.orgName)) ?? defaultEventFixture();
      if (fixture) {
        const fakeRun = {
          id: "demo",
          profileId: profile.id,
          status: "done" as const,
          notices: fixture.meta.notices,
          startedAt: fixture.meta.capturedAt ?? new Date().toISOString(),
          finishedAt: fixture.meta.capturedAt ?? new Date().toISOString(),
        };
        return NextResponse.json({ run: fakeRun, matches: fixture.matches, cached: true });
      }
      // No fixture captured yet — fall through to live
    }

    // Owner RLS scopes both reads; no admin client in the polling path.
    const [run, matches] = await Promise.all([
      latestMatchRun(supabase, profile.id),
      loadEventFeed(supabase, profile.id),
    ]);
    return NextResponse.json({ run, matches });
  } catch (err) {
    console.error("[/api/events/match GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load match state." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId : undefined;
    const { profile, unauthorized } = await loadProfile(profileId);
    if (unauthorized) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: profileId ? "Profile not found." : "No profile yet." },
        { status: 404 },
      );
    }

    // Demo fallback: return the captured fixture immediately, no network calls.
    if (process.env.DEMO_FALLBACK === "1") {
      const fixture =
        loadEventFixture(slugifyPersona(profile.orgName)) ?? defaultEventFixture();
      if (fixture) {
        return NextResponse.json({
          matches: fixture.matches,
          receipt: fixture.receipt,
          meta: fixture.meta,
          cached: true,
          run: {
            id: "demo",
            profileId: profile.id,
            status: "done",
            notices: fixture.meta.notices,
            startedAt: fixture.meta.capturedAt ?? new Date().toISOString(),
            finishedAt: fixture.meta.capturedAt ?? new Date().toISOString(),
          },
        });
      }
      // No fixture yet — fall through to live run so capture can work
    }

    const admin = createSupabaseAdminClient();
    const run = await createMatchRun(admin, profile.id, "live_running");
    if (!run) {
      return NextResponse.json(
        {
          error:
            "Match run tracking is not available (database migrations pending). Apply supabase db push.",
        },
        { status: 503 },
      );
    }
    const result = await runLiveMatchTracked(admin, profile, run.id);

    if (!result) {
      // The tracked runner already wrote the failure to match_runs.
      const failed = await latestMatchRun(admin, profile.id);
      return NextResponse.json(
        { error: failed?.error ?? "Event matching failed.", run: failed },
        { status: 502 },
      );
    }

    // Write-on-success capture (opt-in via env — captures real output for demo).
    if (process.env.CAPTURE_EVENT_FIXTURE === "1") {
      const slug = slugifyPersona(profile.orgName);
      await captureEventFixture(slug, result).catch((err) =>
        console.warn("[event-fixture] capture failed:", err instanceof Error ? err.message : err),
      );
    }

    return NextResponse.json({
      matches: result.matches,
      receipt: result.receipt,
      meta: result.meta,
      cached: false,
      costsPersisted: true, // persisted inside the tracked runner
      run: await latestMatchRun(admin, profile.id),
    });
  } catch (err) {
    console.error("[/api/events/match POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Event matching failed." },
      { status: 500 },
    );
  }
}
