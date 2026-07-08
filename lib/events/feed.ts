import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToEvent, rowToEventMatch, type EventMatchRow, type EventRow } from "./event-row";
import { sortEventFeedItems, type EventFeedItem } from "./feed-item";

type EventMatchFeedRow = EventMatchRow & {
  event: EventRow | EventRow[] | null;
};

function firstEvent(row: EventMatchFeedRow): EventRow | undefined {
  if (Array.isArray(row.event)) return row.event[0];
  return row.event ?? undefined;
}

export async function loadEventFeed(
  supabase: SupabaseClient,
  profileId: string,
): Promise<EventFeedItem[]> {
  const { data, error } = await supabase
    .from("event_matches")
    .select("*, event:events(*)")
    .eq("profile_id", profileId)
    .in("status", ["recommended", "saved"]);

  if (error) throw error;

  const items = ((data ?? []) as EventMatchFeedRow[]).flatMap((row) => {
    const event = firstEvent(row);
    if (!event) return [];
    return [{ ...rowToEventMatch(row), event: rowToEvent(event) }];
  });

  return sortEventFeedItems(items);
}
