// STAGE: validate (code, NOT model). The mechanical citation guarantee.
// Any evidence URL that is not in the fetched set is stripped; any card left
// with zero evidence is dropped. This is what makes "citation or no card" a
// property of the system rather than a request to the model. DO NOT weaken it.
import type { IdeaCard } from "@/types";
import type { Evidence as FetchedEvidence } from "@/lib/data/tavily";
import type { IdeaCardCore } from "./schema";

/** Normalize for set membership: lowercase host, drop fragment + trailing slash.
 *  Robust to trivial formatting differences, still strict about origin+path. */
function normUrl(u: string): string | null {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    let s = `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.search}`;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

let counter = 0;
function cardId(): string {
  counter += 1;
  return `card_${Date.now().toString(36)}_${counter}`;
}

export interface ValidationResult {
  cards: IdeaCard[];
  droppedForNoCitation: number;
}

export function validateCards(
  cards: IdeaCardCore[],
  fetched: FetchedEvidence[],
): ValidationResult {
  const allowed = new Set<string>();
  for (const e of fetched) {
    const n = normUrl(e.url);
    if (n) allowed.add(n);
  }

  const out: IdeaCard[] = [];
  let dropped = 0;

  for (const card of cards) {
    // Keep only evidence whose URL was actually fetched.
    const evidence = card.evidence.filter((ev) => {
      const n = normUrl(ev.url);
      return n !== null && allowed.has(n);
    });

    if (evidence.length === 0) {
      dropped += 1; // hallucinated / unsourced — no card
      continue;
    }

    // Comparables must also cite a fetched URL, else drop the comparable.
    const comparables = (card.comparables ?? []).filter((c) => {
      const n = normUrl(c.url);
      return n !== null && allowed.has(n);
    });

    out.push({
      id: cardId(),
      lane: card.lane,
      idea: card.idea,
      whyItFitsYou: card.whyItFitsYou,
      evidence,
      comparables: comparables.length ? comparables : undefined,
      executionSteps: card.executionSteps,
      confidence: card.confidence,
      // Event-lane extras
      eventDates: card.eventDates,
      eventLocation: card.eventLocation,
      knownPastSponsors: card.knownPastSponsors,
      organizerContact: card.organizerContact,
      sponsorCost: card.sponsorCost,
      // Donor-lane extras
      donorType: card.donorType,
      approachAngle: card.approachAngle,
    });
  }

  return { cards: out, droppedForNoCitation: dropped };
}
