// Sign-in: Google OAuth only (most nonprofits run on Google Workspace).
// Calendar scope is NOT requested here — it is asked for lazily at first
// "Sync to Calendar" (see lib/auth/google.ts).
import Image from "next/image";
import Link from "next/link";
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
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Brand panel — the dossier's cover. Hidden on small screens. */}
      <aside className="relative hidden overflow-hidden bg-brand p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(40rem 22rem at 15% 0%, color-mix(in oklab, var(--signal) 45%, transparent), transparent 68%)",
          }}
        />
        <Link href="/" className="relative inline-flex">
          <span className="rounded-2xl bg-white p-3 shadow-lg">
            <Image
              src="/volition-logo.png"
              alt="Volition"
              width={144}
              height={144}
              priority
              className="h-20 w-20 object-contain"
            />
          </span>
        </Link>

        <div className="relative max-w-md">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-foreground/60">
            Fundraising-event intelligence
          </p>
          <p className="mt-4 font-display text-3xl font-semibold leading-tight text-brand-foreground">
            &ldquo;Three of your target foundations sit on the host
            committee.&rdquo;
          </p>
          <p className="mt-4 text-sm leading-relaxed text-brand-foreground/70">
            Every match Volition shows you is scored, sourced, and costed — so
            you can walk into a board meeting with the receipt.
          </p>
        </div>

        <p className="relative font-mono text-xs text-brand-foreground/50">
          citation or no signal
        </p>
      </aside>

      {/* Sign-in panel. */}
      <main className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <p className="eyebrow">Volition</p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in to build your org profile and get matched to events worth
            your time — every claim cited, every cost on the receipt.
          </p>

          <div className="mt-8">
            {supabaseConfigured() ? (
              <GoogleSignInButton />
            ) : (
              <p className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal-foreground dark:text-signal">
                Sign-in isn&apos;t available on this deployment yet — Supabase
                isn&apos;t configured.
              </p>
            )}

            {error && (
              <p className="mt-3 text-sm text-destructive">
                Sign-in failed. Please try again.
              </p>
            )}
          </div>

          <p className="mt-8 font-mono text-xs text-muted-foreground">
            Google Workspace sign-in · calendar access asked for later, only
            when you sync
          </p>
        </div>
      </main>
    </div>
  );
}
