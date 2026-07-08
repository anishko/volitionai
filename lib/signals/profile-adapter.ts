// The single seam between stored profiles and the matcher. The pipeline
// consumes NonprofitProfileForMatch (which carries cause_sub_tags + budget cap,
// per the v3 migration); a nonprofit_profiles DB row maps into it here. Until a
// real profile exists, callers pass TEST_PROFILE — this function is the ONE
// place that changes when profiles are wired in, by design.
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
