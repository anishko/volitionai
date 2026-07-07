// Sign-in: Google OAuth only (most nonprofits run on Google Workspace).
// Calendar scope is NOT requested here — it is asked for lazily at first
// "Sync to Calendar" (see lib/auth/google.ts).
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("nonprofit_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      redirect(profile ? "/events" : "/onboarding");
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Volition
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Find the rooms where your next donors already are.
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to build your org profile and get matched to events worth
            your time — every claim cited, every cost on the receipt.
          </p>
        </div>

        {supabaseConfigured() ? (
          <GoogleSignInButton />
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Sign-in is not available on this deployment yet (Supabase is not
            configured).
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600">
            Sign-in failed. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
