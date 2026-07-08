// Event detail page (issue #6): where an org lands after clicking an event in
// the feed. Auth + config guards mirror the feed page; a missing or malformed
// id renders the framework 404. All presentation lives in <EventDetail/>.
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { loadEventById } from "@/lib/events/store";
import { EventDetail } from "@/components/event-detail";

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

  return <EventDetail event={event} />;
}
