// POST /api/nonprofit/profile — save onboarding form, run LOCAL extraction,
// store profile + cost events. GET — current user's profile.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistCostEvents } from "@/lib/supabase/costs";
import { OnboardingFormSchema } from "@/lib/nonprofit/onboarding-schema";
import { extractNonprofitProfile } from "@/lib/nonprofit/extract";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { CostMeter, newRunId } from "@/lib/ai/cost";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    // LOCAL extraction ($0; metered cloud fallback if Ollama is unreachable).
    const meter = new CostMeter(newRunId());
    const extracted = await extractNonprofitProfile(meter, form);

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

    return NextResponse.json({
      profile,
      receipt: meter.receipt(),
      costsPersisted: persisted,
    });
  } catch (err) {
    console.error("[/api/nonprofit/profile POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save profile." },
      { status: 500 },
    );
  }
}
