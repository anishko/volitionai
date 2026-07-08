// Read-only access to the current user's nonprofit profile for the planning
// surface. Reads the v3 budget columns (annual_budget_cap, budget_period)
// directly rather than through lib/nonprofit's rowToNonprofitProfile, which
// does not map them — consuming existing exports read-only and keeping our
// additive concerns in our own module.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlanProfile {
  id: string;
  orgName: string;
  annualBudgetCap?: number;
  budgetPeriod?: string;
}

/**
 * Load the signed-in user's profile with budget fields. Degrades gracefully if
 * the v3 budget columns are not applied yet (falls back to the base columns).
 */
export async function loadPlanProfile(
  supabase: SupabaseClient,
): Promise<PlanProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const withBudget = await supabase
    .from("nonprofit_profiles")
    .select("id, org_name, annual_budget_cap, budget_period")
    .eq("user_id", user.id)
    .maybeSingle();

  let row = withBudget.data as
    | { id: string; org_name: string; annual_budget_cap: number | null; budget_period: string | null }
    | null;

  if (withBudget.error) {
    // Budget columns missing (older schema) — retry with just the base fields.
    const base = await supabase
      .from("nonprofit_profiles")
      .select("id, org_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (base.error || !base.data) return null;
    row = { ...(base.data as { id: string; org_name: string }), annual_budget_cap: null, budget_period: null };
  }

  if (!row) return null;
  return {
    id: row.id,
    orgName: row.org_name,
    annualBudgetCap:
      typeof row.annual_budget_cap === "number" ? row.annual_budget_cap : undefined,
    budgetPeriod: row.budget_period ?? undefined,
  };
}
