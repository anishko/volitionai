// One-time onboarding: 8-field structured form → POST /api/nonprofit/profile.
// Users with a profile already are sent straight to /events; middleware sends
// signed-out users to /login before this renders.
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

// Session + profile checks must run per-request, never at build time.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("nonprofit_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile) redirect("/events");

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Volition
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tell us about your org.
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
            Two minutes, once. We build a persistent profile and use it to find
            events where your target donors actually show up.
          </p>
        </header>
        <OnboardingForm />
      </div>
    </div>
  );
}
