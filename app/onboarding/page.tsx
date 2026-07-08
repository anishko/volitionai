// One-time onboarding: structured form with selection chips. Users with a
// profile already are sent to /events; middleware sends signed-out users to
// /login before this renders.
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
    <div className="min-h-screen w-full bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10 text-center">
          <p className="eyebrow">Volition</p>
          <h1 className="mt-3 text-4xl tracking-[-0.01em] text-foreground">
            Tell us about your org.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            About two minutes, once. Pick your cause areas, donors, and goals —
            we build a persistent profile locally and use it to find events
            where your target donors actually show up.
          </p>
        </header>
        <OnboardingForm />
      </div>
    </div>
  );
}
