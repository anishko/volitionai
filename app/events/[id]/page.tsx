// Event detail page (issue #6): where an org lands after clicking an event in
// the feed. Auth + config guards mirror the feed page; a missing or malformed
// id renders the framework 404. All presentation lives in <EventDetail/>.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { loadEventById } from "@/lib/events/store";
import { EventDetail } from "@/components/event-detail";
import { buttonVariants } from "@/components/ui/button";

// Session read must run per-request, never at build time.
export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!supabaseConfigured()) redirect("/login");
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const event = await loadEventById(supabase, id);
  if (!event) notFound();

  // The debrief flow is keyed by matchId; RLS scopes event_matches to the owner,
  // so this returns the caller's match for this event (if any) and nothing else.
  const { data: match } = await supabase
    .from("event_matches")
    .select("id")
    .eq("event_id", id)
    .maybeSingle();

  return (
    <div className="bg-zinc-50 dark:bg-black">
      <EventDetail event={event} />
      {match && (
        <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-8">
          <Link
            href={`/debriefs/${match.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Add debrief
          </Link>
        </div>
      )}
    </div>
  );
}
