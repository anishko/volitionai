// Post-onboarding home. The matching feed lands with issue #4; until then
// this page proves the auth + profile loop end to end and shows what the
// extraction produced.
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Volition · Events
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {profile.orgName}
            </h1>
          </div>
          <SignOutButton />
        </header>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Your profile is ready.
          </p>
          {extracted?.missionSummary && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {extracted.missionSummary}
            </p>
          )}
          {extracted?.causeKeywords && extracted.causeKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {extracted.causeKeywords.map((k) => (
                <Badge key={k} variant="secondary">
                  {k}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Event matching is on its way — your first &ldquo;For You&rdquo; feed
            will use this profile to find conferences where your target donors
            already are.
          </p>
        </div>
      </div>
    </div>
  );
}
