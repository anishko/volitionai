// POST /api/nonprofit/profile — save onboarding form, run LOCAL extraction,
// store profile + cost events, then populate the events feed: seed-floor
// matches synchronously (ADR-0005: /events is never empty on first load) and
// the live match run in the background. GET — current user's profile.
// PATCH — update profile fields, re-run extraction, emit cost event.
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistCostEvents } from "@/lib/supabase/costs";
import { OnboardingFormSchema, PartialOnboardingSchema } from "@/lib/nonprofit/onboarding-schema";
import { extractNonprofitProfile } from "@/lib/nonprofit/extract";
import { scrapeWebsiteSummary } from "@/lib/nonprofit/website";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { runSeedFloor } from "@/lib/events/floor";
import { createMatchRun, runLiveMatchTracked, updateMatchRun } from "@/lib/events/runs";
import { CostMeter, newRunId } from "@/lib/ai/cost";
import type { MatchRun } from "@/types";

export const runtime = "nodejs";
// Extraction is quick, but the background live run scheduled via after()
// shares this budget on serverless hosts.
export const maxDuration = 180;

function isMissingProfileGeographyColumn(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (code === "PGRST204") {
    return /headquarters|cities_of_interest|regions_of_interest/.test(message);
  }
  return (
    message.includes("nonprofit_profiles.headquarters") ||
    message.includes("nonprofit_profiles.cities_of_interest") ||
    message.includes("nonprofit_profiles.regions_of_interest") ||
    message.includes("'headquarters' column") ||
    message.includes("'cities_of_interest' column") ||
    message.includes("'regions_of_interest' column")
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("nonprofit_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "No profile yet." }, { status: 404 });
    }
    return NextResponse.json({ profile: rowToNonprofitProfile(data as NonprofitProfileRow) });
  } catch (err) {
    console.error("[/api/nonprofit/profile GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const parsed = OnboardingFormSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid form data." },
        { status: 400 },
      );
    }
    const form = parsed.data;

    // Onboarding is one-time; profile edits arrive with the /profile page (PATCH).
    const { data: existing } = await supabase
      .from("nonprofit_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Profile already exists.", profileId: existing.id },
        { status: 409 },
      );
    }

    const meter = new CostMeter(newRunId());

    // Scrape homepage + /about to enrich extraction with real website content.
    // Failures are non-fatal: website enrichment is best-effort.
    const websiteSummary = form.website
      ? await scrapeWebsiteSummary(form.website, meter).catch(() => null)
      : null;

    // LOCAL extraction ($0; metered cloud fallback if Ollama is unreachable).
    const extracted = await extractNonprofitProfile(meter, form, websiteSummary ?? undefined);

    const baseProfileInsert = {
      user_id: user.id,
      org_name: form.orgName,
      website: form.website ?? null,
      cause_areas: form.causeAreas,
      geography_focus: form.geographyFocus,
      geography_detail: form.geographyDetail ?? null,
      org_size: form.orgSize,
      current_donor_mix: form.currentDonorMix,
      target_donor_type: form.targetDonorType,
      primary_goal: form.primaryGoal,
      open_ended_notes: form.openEndedNotes ?? null,
      extracted_profile: extracted,
      cause_sub_tags: form.causeSubTags ?? [],
      qualitative_signals: form.qualitativeSignals ?? null,
      internal_facts: websiteSummary ? { websiteSummary } : null,
    };
    const profileInsert = {
      ...baseProfileInsert,
      headquarters: form.headquarters ?? null,
      cities_of_interest: form.citiesOfInterest ?? [],
      regions_of_interest: form.regionsOfInterest ?? [],
    };

    // Insert through the user-scoped client so RLS owner policies apply.
    let { data: row, error: insertError } = await supabase
      .from("nonprofit_profiles")
      .insert(profileInsert)
      .select("*")
      .single();
    if (insertError && isMissingProfileGeographyColumn(insertError)) {
      console.warn(
        "[/api/nonprofit/profile POST] profile geography columns are not applied yet; creating profile without geography fields.",
      );
      const retry = await supabase
        .from("nonprofit_profiles")
        .insert(baseProfileInsert)
        .select("*")
        .single();
      row = retry.data;
      insertError = retry.error;
    }
    if (insertError) throw insertError;

    const profile = rowToNonprofitProfile(row as NonprofitProfileRow);
    const { persisted } = await persistCostEvents({
      events: meter.events,
      runType: "profile_extraction",
      entityId: profile.id,
    });

    // Seed floor (ADR-0005): populate the feed from the corpus right now, $0,
    // so the user lands on /events with cards already there. A floor failure
    // must not fail onboarding - the live run can still populate the feed.
    const admin = createSupabaseAdminClient();
    let matchRun: MatchRun | null = null;
    let floorMatches = 0;
    let floorError: string | null = null;
    try {
      const floor = await runSeedFloor(admin, profile);
      floorMatches = floor.matches.length;
      matchRun = await createMatchRun(admin, profile.id, "floor_ready");
      if (matchRun && floor.relaxed) {
        await updateMatchRun(admin, matchRun.id, {
          notices: [
            "Not enough exact matches; results were broadened to related causes or virtual events (labeled by tier).",
          ],
        });
      }
    } catch (err) {
      floorError =
        err instanceof Error ? err.message : "Initial event matching failed.";
      console.error("[/api/nonprofit/profile POST] seed floor failed:", err);
      matchRun = await createMatchRun(admin, profile.id, "failed");
      if (matchRun) {
        await updateMatchRun(admin, matchRun.id, {
          error: "Initial matching failed; retry from the events page.",
          finished: true,
        }).catch(() => {});
      }
    }

    // Live run in the background: the response returns immediately with the
    // floor in place; the feed polls match_runs and merges live results.
    if (matchRun && matchRun.status !== "failed") {
      const runId = matchRun.id;
      after(() => runLiveMatchTracked(admin, profile, runId));
    }

    return NextResponse.json({
      profile,
      receipt: meter.receipt(),
      costsPersisted: persisted,
      floorMatches,
      floorError,
      matchRunId: matchRun?.id ?? null,
    });
  } catch (err) {
    console.error("[/api/nonprofit/profile POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save profile." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const parsed = PartialOnboardingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid form data." },
        { status: 400 },
      );
    }
    const patch = parsed.data;

    const { data: existingRow } = await supabase
      .from("nonprofit_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existingRow) {
      return NextResponse.json({ error: "No profile to update." }, { status: 404 });
    }

    const existing = rowToNonprofitProfile(existingRow as NonprofitProfileRow);

    // Merge patch on top of stored values so extractNonprofitProfile always
    // receives a complete OnboardingForm even when the patch is partial.
    const parsed2 = OnboardingFormSchema.safeParse({
      orgName: patch.orgName ?? existing.orgName,
      website: patch.website ?? existing.website,
      causeAreas: patch.causeAreas ?? existing.causeAreas,
      geographyFocus: patch.geographyFocus ?? existing.geographyFocus ?? "national",
      geographyDetail: patch.geographyDetail ?? existing.geographyDetail,
      headquarters: patch.headquarters ?? existing.headquarters,
      citiesOfInterest: patch.citiesOfInterest ?? existing.citiesOfInterest ?? [],
      regionsOfInterest: patch.regionsOfInterest ?? existing.regionsOfInterest ?? [],
      orgSize: patch.orgSize ?? existing.orgSize,
      currentDonorMix: patch.currentDonorMix ?? existing.currentDonorMix ?? [],
      targetDonorType: patch.targetDonorType ?? existing.targetDonorType ?? [],
      primaryGoal: patch.primaryGoal ?? existing.primaryGoal,
      openEndedNotes: patch.openEndedNotes ?? existing.openEndedNotes,
      causeSubTags: patch.causeSubTags ?? [],
      qualitativeSignals: patch.qualitativeSignals,
    });
    if (!parsed2.success) {
      return NextResponse.json(
        { error: parsed2.error.issues[0]?.message ?? "Merged form data is invalid." },
        { status: 400 },
      );
    }
    const form = parsed2.data;

    const meter = new CostMeter(newRunId());

    const extracted = await extractNonprofitProfile(meter, form, undefined);

    // Build update object from only the fields present in the partial patch.
    // We use `patch` (not the merged `form`) to avoid overwriting stored fields
    // that were absent from the request body.
    const baseUpdate: Record<string, unknown> = { extracted_profile: extracted };
    if (patch.orgName !== undefined) baseUpdate.org_name = form.orgName;
    if (patch.website !== undefined) baseUpdate.website = form.website ?? null;
    if (patch.causeAreas !== undefined) baseUpdate.cause_areas = form.causeAreas;
    if (patch.geographyFocus !== undefined) baseUpdate.geography_focus = form.geographyFocus;
    if (patch.geographyDetail !== undefined) baseUpdate.geography_detail = form.geographyDetail ?? null;
    if (patch.orgSize !== undefined) baseUpdate.org_size = form.orgSize;
    if (patch.currentDonorMix !== undefined) baseUpdate.current_donor_mix = form.currentDonorMix;
    if (patch.targetDonorType !== undefined) baseUpdate.target_donor_type = form.targetDonorType;
    if (patch.primaryGoal !== undefined) baseUpdate.primary_goal = form.primaryGoal;
    if (patch.openEndedNotes !== undefined) baseUpdate.open_ended_notes = form.openEndedNotes ?? null;
    if (patch.causeSubTags !== undefined) baseUpdate.cause_sub_tags = form.causeSubTags;
    if (patch.qualitativeSignals !== undefined)
      baseUpdate.qualitative_signals = form.qualitativeSignals ?? null;

    const fullUpdate = { ...baseUpdate };
    const hasGeographyFields =
      patch.headquarters !== undefined ||
      patch.citiesOfInterest !== undefined ||
      patch.regionsOfInterest !== undefined;
    if (patch.headquarters !== undefined) fullUpdate.headquarters = form.headquarters ?? null;
    if (patch.citiesOfInterest !== undefined) fullUpdate.cities_of_interest = form.citiesOfInterest;
    if (patch.regionsOfInterest !== undefined) fullUpdate.regions_of_interest = form.regionsOfInterest;

    let { data: row, error: updateError } = await supabase
      .from("nonprofit_profiles")
      .update(fullUpdate)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError && hasGeographyFields && isMissingProfileGeographyColumn(updateError)) {
      console.warn(
        "[/api/nonprofit/profile PATCH] geography columns not yet applied; updating without them.",
      );
      const retry = await supabase
        .from("nonprofit_profiles")
        .update(baseUpdate)
        .eq("user_id", user.id)
        .select("*")
        .single();
      row = retry.data;
      updateError = retry.error;
    }
    if (updateError) throw updateError;

    const profile = rowToNonprofitProfile(row as NonprofitProfileRow);
    const { persisted } = await persistCostEvents({
      events: meter.events,
      runType: "profile_extraction",
      entityId: profile.id,
    });

    return NextResponse.json({ profile, receipt: meter.receipt(), costsPersisted: persisted });
  } catch (err) {
    console.error("[/api/nonprofit/profile PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile." },
      { status: 500 },
    );
  }
}
