import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { rowToEvent, type EventRow } from "@/lib/events/event-row";
import { rowToEventPlan, type EventPlanRow } from "@/lib/plans/plan-row";
import { PlanList, type PlanWithEvent } from "@/components/plan-list";

// Session + plan data must be read per-request, never at build time.
export const dynamic = "force-dynamic";

const PLAN_COLUMNS =
  "id, profile_id, event_id, participation_tier, checklist, budget_period, registration_cost, registration_cost_source_url, registration_cost_verified_at, estimated_travel_cost, calendar_synced_at, created_at, updated_at";

export default async function PlanPage() {
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("nonprofit_profiles")
    .select("id, org_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profileRow) redirect("/onboarding");
  const orgName = (profileRow as { org_name: string }).org_name;

  const { data: planRows } = await supabase
    .from("event_plans")
    .select(PLAN_COLUMNS)
    .order("created_at", { ascending: false });

  const plans = (planRows ?? []).map((r) => rowToEventPlan(r as EventPlanRow));
  const eventIds = [...new Set(plans.map((p) => p.eventId))];
  const eventsById = new Map<string, ReturnType<typeof rowToEvent>>();
  if (eventIds.length > 0) {
    const { data: eventRows } = await supabase.from("events").select("*").in("id", eventIds);
    for (const row of eventRows ?? []) {
      const event = rowToEvent(row as EventRow);
      eventsById.set(event.id, event);
    }
  }

  const initialPlans: PlanWithEvent[] = plans.map((plan) => ({
    plan,
    event: eventsById.get(plan.eventId) ?? null,
  }));

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Volition · Plan
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Plans for {orgName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Each saved event becomes a deadline checklist. Auto-filled deadlines link to
              their source; where a scrape found none, the task says so rather than guessing.
            </p>
          </div>
          <nav className="flex shrink-0 gap-3 text-sm">
            <Link
              href="/events"
              className="rounded-md border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200"
            >
              Events
            </Link>
            <Link
              href="/plan/annual"
              className="rounded-md border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200"
            >
              Annual plan
            </Link>
            <Link
              href="/settings"
              className="rounded-md border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200"
            >
              Settings
            </Link>
          </nav>
        </header>

        <PlanList initialPlans={initialPlans} />
      </div>
    </div>
  );
}
