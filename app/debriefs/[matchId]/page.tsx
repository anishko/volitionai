// /debriefs/[matchId] — post-event debrief (Phase 7, v1.5). Planned-vs-actual:
// the plan's SOURCED budget figures on one side, the org's own reported actuals
// on the other. Auth + config guards mirror the outreach page; a missing /
// non-owned match renders 404 (RLS scopes the match to the caller). All
// interactivity lives in <DebriefForm/>, which loads the plan + any existing
// debrief from GET /api/debriefs?matchId=…
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { DebriefForm } from "@/components/debrief-form";

export const dynamic = "force-dynamic";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  if (!supabaseConfigured()) redirect("/login");
  const { matchId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes event_matches to the owner, so a foreign / missing id → 404.
  const { data: match } = await supabase
    .from("event_matches")
    .select("id, events(name)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) notFound();

  // Embedded to-one may arrive as an object or a single-element array.
  const embedded = (match as { events?: { name?: string } | { name?: string }[] }).events;
  const eventName =
    (Array.isArray(embedded) ? embedded[0]?.name : embedded?.name) ?? "this event";

  return <DebriefForm matchId={matchId} eventName={eventName} />;
}
