// Sign-in: Google OAuth only (most nonprofits run on Google Workspace).
// Calendar scope is NOT requested here — it is asked for lazily at first
// "Sync to Calendar" (see lib/auth/google.ts).
// Styled to match the landing page: olive/greige theme, wordmark nav, one
// centered paper card. Type comes from the global scheme (Gambarino
// headings / Switzer Light body).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata = {
  title: "Sign in — Volition",
};

// Same code-rendered monogram as the landing page: a bold ink "V" with a
// small white "o" dot on its right stroke. Keeps the mark consistent across
// the flow (stroke follows the foreground token so it holds in dark mode).
function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0 text-foreground"
    >
      <path
        d="M6.5 7.5 L16 24.5 L25.5 7.5"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.6" cy="12.6" r="3.1" fill="#fff" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Monogram />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">
        Volition
      </span>
    </span>
  );
}

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
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      {/* Same nav bar as the landing page, pared down. */}
      <header className="sticky top-0 z-40 border-b border-border bg-[rgba(244,241,233,0.85)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Volition home">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[#ece8da]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_24px_60px_-24px_rgba(44,46,35,0.35)] sm:p-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-signal">
              Sign in
            </p>
            <h1 className="mt-3 text-4xl tracking-[-0.01em] text-foreground">
              Welcome.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sign in to build your org profile and get matched to events worth
              your time — every claim cited, every cost on the receipt.
            </p>

            <div className="mt-8">
              {supabaseConfigured() ? (
                <GoogleSignInButton />
              ) : (
                <p className="rounded-[10px] border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-foreground">
                  Sign-in isn&apos;t available on this deployment yet —
                  Supabase isn&apos;t configured.
                </p>
              )}

              {error && (
                <p className="mt-3 text-sm text-destructive">
                  Sign-in failed. Please try again.
                </p>
              )}
            </div>

            <div className="mt-8 border-t border-border pt-5">
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                Google Workspace sign-in · calendar access asked for later,
                only when you sync
              </p>
            </div>
          </div>

          <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
            citation or no card
          </p>
        </div>
      </main>
    </div>
  );
}
