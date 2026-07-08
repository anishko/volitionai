import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { EventsFeed } from "@/components/events-feed";
import { loadEventFeed } from "@/lib/events/feed";

// Session + profile checks must run per-request, never at build time.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
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
  const initialItems = await loadEventFeed(supabase, profile.id);

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
          <SignOutButton />
        </header>

        <EventsFeed profileId={profile.id} initialItems={initialItems} />
      </div>
    </div>
  );
}
