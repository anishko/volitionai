import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { buildAnnualPlan } from "@/lib/plans/annual";
import { AnnualPlanBoard } from "@/components/annual-plan-board";

// Budget + slate data must be read per-request, never at build time.
export const dynamic = "force-dynamic";

export default async function AnnualPlanPage() {
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const annual = await buildAnnualPlan(supabase);
  if (!annual) redirect("/onboarding");

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Volition · Annual plan
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Annual Conference Plan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Assemble the year&apos;s slate of events whose total cited registration cost fits
              your budget. Registration costs are sourced; travel is a labeled estimate; events
              without a sourced cost are excluded from the total.
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
              href="/plan"
              className="rounded-md border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200"
            >
              Plans
            </Link>
          </nav>
        </header>

        <AnnualPlanBoard initial={annual} />
      </div>
    </div>
  );
}
