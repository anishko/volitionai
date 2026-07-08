import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import { EventsFeed } from "@/components/events-feed";
import { loadEventFeed } from "@/lib/events/feed";
import { latestMatchRun } from "@/lib/events/runs";
import type { EventFeedItem } from "@/lib/events/feed-item";
import type { MatchRun } from "@/types";

// Session + profile checks must run per-request, never at build time.
export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("nonprofit_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) redirect("/onboarding");

  const profile = rowToNonprofitProfile(row as NonprofitProfileRow);
  const extracted = profile.extractedProfile as
    | { missionSummary?: string; causeKeywords?: string[]; eventSearchHints?: string[] }
    | undefined;

  let initialItems: EventFeedItem[] = [];
  let initialRun: MatchRun | null = null;
  let feedLoadError: string | null = null;
  try {
    [initialItems, initialRun] = await Promise.all([
      loadEventFeed(supabase, profile.id),
      latestMatchRun(supabase, profile.id),
    ]);
  } catch (err) {
    console.error("[/events] failed to load feed or match run:", err);
    feedLoadError =
      err instanceof Error ? err.message : "Could not load your recommended events.";
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Volition · Events
            </p>
            <h1 className="mt-1 text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">
              Events for {profile.orgName}
            </h1>
            {extracted?.missionSummary && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {extracted.missionSummary}
              </p>
            )}
            {extracted?.causeKeywords && extracted.causeKeywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extracted.causeKeywords.slice(0, 8).map((k) => (
                  <Badge key={k} variant="secondary">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/profile"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Settings
            </Link>
            <UserMenu user={user} />
          </div>
        </header>

        {notice === "seed-failed" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Your profile was saved, but initial event matching did not complete. Use
            &quot;Find more events&quot; below to retry.
          </div>
        )}
        {notice === "seed-empty" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Your profile was saved, but no events matched yet. Use &quot;Find more
            events&quot; below to run a full search.
          </div>
        )}

        {feedLoadError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {feedLoadError} Try &quot;Find more events&quot; below, or ask your admin to run{" "}
            <code className="text-xs">supabase db push</code>.
          </div>
        )}

        <EventsFeed
          profileId={profile.id}
          initialItems={initialItems}
          initialRun={initialRun}
        />
      </div>
    </div>
  );
}
