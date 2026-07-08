// Settings page (issue #11): account and integration controls.
// Simple server component - auth redirect guard, then static layout.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { calendarSyncEnabled } from "@/lib/auth/google";
import { SignOutButton } from "@/components/sign-out-button";
import { ResetOnboardingButton } from "@/components/reset-onboarding-button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!supabaseConfigured()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const calendarEnabled = calendarSyncEnabled();

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Volition · Settings
          </p>
          <h1 className="mt-1 text-3xl tracking-tight text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
        </header>

        {/* Account section */}
        <section aria-labelledby="account-heading">
          <h2
            id="account-heading"
            className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-400"
          >
            Account
          </h2>
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {user.email ?? "Signed in"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Signed in via Google
                </p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </section>

        {/* Integrations section */}
        <section aria-labelledby="integrations-heading">
          <h2
            id="integrations-heading"
            className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-400"
          >
            Integrations
          </h2>
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {calendarEnabled ? (
              <div className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4 text-zinc-600 dark:text-zinc-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      Google Calendar
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      Connected via Google OAuth.
                      Revoking access requires disconnecting your Google account from your{" "}
                      <a
                        href="https://myaccount.google.com/permissions"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        Google account settings
                      </a>
                      .
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Connected
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No integrations enabled.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section aria-labelledby="danger-heading">
          <h2
            id="danger-heading"
            className="mb-4 text-xs font-medium uppercase tracking-widest text-red-400"
          >
            Danger zone
          </h2>
          <div className="rounded-lg border border-red-200 bg-white px-5 py-4 dark:border-red-900/50 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Restart onboarding
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Deletes your org profile, all matched events, and your plan. Cannot be undone.
                </p>
              </div>
              <ResetOnboardingButton />
            </div>
          </div>
        </section>

        {/* Back link */}
        <nav aria-label="Return navigation">
          <Link
            href="/events"
            className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to Events
          </Link>
        </nav>
      </div>
    </div>
  );
}
