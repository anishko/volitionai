// /outreach/[matchId] — outreach drafting surface (docs/NONPROFIT_EVENTS_PRD.md
// → "Outreach drafting"). Auth + config guards mirror the event detail page; a
// missing / non-owned match renders 404 (RLS scopes the match to the caller).
// All interactivity lives in <OutreachDrafter/>; drafting happens on demand.
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { OutreachDrafter } from "@/components/outreach-drafter";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
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

  return <OutreachDrafter matchId={matchId} eventName={eventName} />;
}
