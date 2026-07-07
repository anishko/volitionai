// OAuth callback: exchange the PKCE code for a session, then route by
// profile existence — first-timers to /onboarding, returning users to /events.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("nonprofit_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        return NextResponse.redirect(`${origin}${profile ? "/events" : "/onboarding"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
