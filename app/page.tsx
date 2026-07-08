// Landing page — Attio-style: one giant centered claim and a tabbed
// live-HTML product preview instead of a screenshot. Palette mirrors the
// login page's olive/greige theme, inlined and scoped to this page. Type
// comes from the global scheme (Gambarino headings / Switzer Light body).
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Volition — the insights team engineered for your mission",
  description:
    "Volition researches your world live and finds the donors, sponsors, and events your org runs on — every claim cited, every cost printed on the receipt.",
};

export default async function Home() {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("nonprofit_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      redirect(profile ? "/events" : "/onboarding");
    }
  }
  return <LandingPage />;
}
