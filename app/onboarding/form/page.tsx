// Onboarding form fallback (PRD v4). Same auth + profile guard as the
// conversational intake at /onboarding; the 8-field structured form for users
// who prefer to fill fields directly (or when the local model is unavailable).
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingFormPage() {
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
          <h1 className="mt-1 text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">
            Tell us about your org.
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
            The structured form.{" "}
            <Link href="/onboarding" className="underline">
              Prefer to just chat? →
            </Link>
          </p>
        </header>
        <OnboardingForm />
      </div>
    </div>
  );
}
