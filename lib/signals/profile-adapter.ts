// The single seam between stored profiles and the matcher. The pipeline
// consumes NonprofitProfileForMatch (which carries cause_sub_tags + budget cap,
// per the v3 migration); a nonprofit_profiles DB row maps into it here. Until a
// real profile exists, callers pass TEST_PROFILE — this function is the ONE
// place that changes when profiles are wired in, by design.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GeographyFocus, NonprofitProfileForMatch } from "@/types";

/** Map a raw nonprofit_profiles row (snake_case) into the matcher's shape. */
export function profileRowToMatch(row: Record<string, unknown>): NonprofitProfileForMatch {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.length ? v : undefined);
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ""),
    orgName: String(row.org_name ?? ""),
    website: str(row.website),
    causeAreas: arr(row.cause_areas),
    causeSubTags: arr(row.cause_sub_tags),
    annualBudgetCap: typeof row.annual_budget_cap === "number" ? row.annual_budget_cap : undefined,
    budgetPeriod: str(row.budget_period),
    geographyFocus: str(row.geography_focus) as GeographyFocus | undefined,
    geographyDetail: str(row.geography_detail),
    orgSize: str(row.org_size),
    currentDonorMix: arr(row.current_donor_mix),
    targetDonorType: arr(row.target_donor_type),
    primaryGoal: str(row.primary_goal),
    openEndedNotes: str(row.open_ended_notes),
    extractedProfile: (row.extracted_profile as Record<string, unknown>) ?? undefined,
    voiceProfile: (row.voice_profile as Record<string, unknown>) ?? undefined,
    internalFacts: (row.internal_facts as Record<string, unknown>) ?? undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** Load a profile by id via the service-role client. Returns null when Supabase
 *  is unconfigured or the row is missing — callers degrade to TEST_PROFILE. */
export async function loadProfileForMatch(profileId: string): Promise<NonprofitProfileForMatch | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("nonprofit_profiles")
      .select("*")
      .eq("id", profileId)
      .single();
    if (error || !data) return null;
    return profileRowToMatch(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Ensure a real, FK-valid nonprofit_profiles row exists for a persona and return
 *  its uuid. Used by the acceptance test so persisted event_matches satisfy the
 *  profile_id → nonprofit_profiles → auth.users foreign keys. Idempotent: reuses
 *  the auth user + profile on re-run. Creates clearly-labeled TEST data. */
export async function ensureTestProfileRow(
  admin: SupabaseClient,
  email: string,
  persona: NonprofitProfileForMatch,
): Promise<{ profileId: string; userId: string }> {
  // Find or create the auth user (email is the stable key).
  let userId: string | undefined;
  const { data: list } = await admin.auth.admin.listUsers();
  userId = list?.users.find((u) => u.email === email)?.id;
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !created?.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = created.user.id;
  }

  // Upsert the profile (unique on user_id). Maps the persona to the DB's snake_case.
  const row = {
    user_id: userId,
    org_name: persona.orgName,
    website: persona.website ?? null,
    cause_areas: persona.causeAreas,
    cause_sub_tags: persona.causeSubTags,
    annual_budget_cap: persona.annualBudgetCap ?? null,
    budget_period: persona.budgetPeriod ?? null,
    geography_focus: persona.geographyFocus ?? null,
    geography_detail: persona.geographyDetail ?? null,
    org_size: persona.orgSize ?? null,
    current_donor_mix: persona.currentDonorMix,
    target_donor_type: persona.targetDonorType,
    primary_goal: persona.primaryGoal ?? null,
    open_ended_notes: persona.openEndedNotes ?? null,
  };
  const { data: prof, error: pErr } = await admin
    .from("nonprofit_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select("id")
    .single();
  if (pErr || !prof) throw new Error(`profile upsert failed: ${pErr?.message}`);

  return { profileId: prof.id as string, userId };
}
