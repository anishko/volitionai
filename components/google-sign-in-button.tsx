"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { googleOAuthOptions } from "@/lib/auth/google";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        ...googleOAuthOptions({
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google; no state to reset.
  }

  return (
    <div className="space-y-2">
      <Button onClick={signIn} disabled={loading} className="w-full" size="lg">
        {loading ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
