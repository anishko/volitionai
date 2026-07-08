import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileEditForm } from "@/components/profile-edit-form";
import type { PartialOnboarding } from "@/lib/nonprofit/onboarding-schema";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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

  // Cast stored arrays/enums back to the schema's branded types so TypeScript
  // is satisfied without runtime overhead — values were validated at write time.
  const initialValues: PartialOnboarding = {
    orgName: profile.orgName,
    website: profile.website,
    causeAreas: profile.causeAreas as PartialOnboarding["causeAreas"],
    geographyFocus: profile.geographyFocus as PartialOnboarding["geographyFocus"],
    headquarters: profile.headquarters,
    citiesOfInterest: profile.citiesOfInterest as PartialOnboarding["citiesOfInterest"],
    regionsOfInterest: profile.regionsOfInterest as PartialOnboarding["regionsOfInterest"],
    orgSize: profile.orgSize as PartialOnboarding["orgSize"],
    currentDonorMix: profile.currentDonorMix as PartialOnboarding["currentDonorMix"],
    targetDonorType: profile.targetDonorType as PartialOnboarding["targetDonorType"],
    primaryGoal: profile.primaryGoal as PartialOnboarding["primaryGoal"],
    openEndedNotes: profile.openEndedNotes,
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Volition · Profile
            </p>
            <h1 className="mt-1 text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">
              Edit Profile
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{profile.orgName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/events"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Back to Events
            </Link>
            <SignOutButton />
          </div>
        </header>

        <ProfileEditForm initialValues={initialValues} />
      </div>
    </div>
  );
}
