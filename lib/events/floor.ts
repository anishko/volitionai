// The seed floor (ADR-0005): synchronous, $0 matching over the corpus that
// runs at onboarding so /events is populated before the user ever sees it.
// No external calls, no LLM - just the relaxation cascade + deterministic
// score over what the corpus already holds. The background live run
// overwrites these rows with cloud-explained matches when it lands; until
// then every card carries an honest template explanation and a citation to
// the event's own website (the source every seed field was verified against).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Event, EventMatch, MatchTier, NonprofitProfile, SourcedClaim } from "@/types";
import { filterCandidates, scoreEvent, type TieredEvent } from "./filter";
import { loadEventCorpus, upsertMatches } from "./store";

// Same ceiling as the live run's finalist count: the floor is a starting
// feed, not a dump of the whole corpus.
const FLOOR_MATCH_COUNT = 12;

function templateWhyAttend(profile: NonprofitProfile, tiered: TieredEvent): string {
  const { event, matchTier } = tiered;
  const causes = profile.causeAreas.filter((c) => c !== "other");
  const overlap = event.causeAreaTags
    .filter((t) => causes.includes(t))
    .map((t) => t.replaceAll("_", " "));

  switch (matchTier) {
    case "strict":
      return overlap.length > 0
        ? `Directly serves your ${overlap.join(", ")} focus; dates and location are listed on the event site.`
        : "Matches your profile; dates and location are listed on the event site.";
    case "geo_relaxed":
      return `Serves your ${overlap.join(", ")} focus but sits outside your home area - broadened match.`;
    case "cause_broadened":
      return event.isUniversal
        ? "Cross-sector fundraising conference relevant to nonprofits of any cause - broadened match beyond your listed causes."
        : "Serves causes related to yours - broadened match.";
    case "virtual_floor":
      return "Attendable from anywhere (virtual or hybrid) - broadened match.";
  }
}

export interface SeedFloorResult {
  matches: (EventMatch & { event: Event })[];
  corpusSize: number;
  deepestTier: MatchTier;
  relaxed: boolean;
}

/**
 * Filter + score the shared corpus for this profile and persist the top
 * matches. Never calls an external service; safe to run inline in the
 * onboarding request. Throws only on database failure.
 */
export async function runSeedFloor(
  admin: SupabaseClient,
  profile: NonprofitProfile,
): Promise<SeedFloorResult> {
  const corpus = await loadEventCorpus(admin);
  const filtered = filterCandidates(profile, corpus);

  const top = filtered.kept
    .map((t) => ({ t, score: scoreEvent(profile, t.event, t.event.donorSignals, t.matchTier) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FLOOR_MATCH_COUNT);

  if (top.length === 0) {
    return {
      matches: [],
      corpusSize: corpus.length,
      deepestTier: filtered.deepestTier,
      relaxed: filtered.relaxed,
    };
  }

  const writes = top.map(({ t, score }) => {
    // Citation or no card: the claim is the event's listed details, and the
    // source is the event site those details were verified against.
    const evidence: SourcedClaim[] = [
      {
        claim: `${t.event.name} details (dates, location) as listed by the event site.`,
        sourceUrl: t.event.website,
      },
    ];
    return {
      eventId: t.event.id,
      matchScore: score,
      matchTier: t.matchTier,
      whyAttend: templateWhyAttend(profile, t),
      evidence,
    };
  });

  const stored = await upsertMatches(admin, profile.id, writes);
  const eventById = new Map(top.map(({ t }) => [t.event.id, t.event]));
  const matches = stored.flatMap((m) => {
    const event = eventById.get(m.eventId);
    return event ? [{ ...m, event }] : [];
  });

  return {
    matches,
    corpusSize: corpus.length,
    deepestTier: filtered.deepestTier,
    relaxed: filtered.relaxed,
  };
}
