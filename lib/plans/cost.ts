// Cited registration-cost extraction for budget-capped annual planning.
// Citation or no number: a cost counts toward the annual total only when the
// event tier carries a numeric cost AND a source_url AND a verified_at stamp.
// Anything else is "cost unverified" and is EXCLUDED from the total — never
// guessed, never estimated into the sourced column. (Travel is a separate,
// explicitly-labeled estimate; see event_plans.estimated_travel_cost.)
import type { Event, EventParticipationTier } from "@/types";
import { findEventTier, normalizeTier, type PlanTier } from "./checklist";

export interface CitedRegistrationCost {
  amount: number;
  sourceUrl: string;
  verifiedAt: string;
}

/**
 * Parse a scraped cost string into a number of dollars, or null when it is not
 * an unambiguous amount. "Free" / "$0" → 0; "$1,200" → 1200; "Varies",
 * "Contact us", "" → null (excluded from the total).
 */
export function parseCitedCost(cost?: string): number | null {
  if (cost == null) return null;
  const raw = cost.trim();
  if (raw.length === 0) return null;
  if (/free|no cost|complimentary/i.test(raw)) return 0;
  const digits = raw.replace(/[^0-9.]/g, "");
  if (digits.length === 0) return null;
  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** The cited registration cost for a tier, or null if it isn't fully sourced. */
export function citedCostForTier(
  tier: EventParticipationTier | undefined,
): CitedRegistrationCost | null {
  if (!tier || !tier.sourceUrl || !tier.verifiedAt) return null;
  const amount = parseCitedCost(tier.cost);
  if (amount === null) return null;
  return { amount, sourceUrl: tier.sourceUrl, verifiedAt: tier.verifiedAt };
}

/** The cited registration cost for an event at a chosen participation tier. */
export function citedRegistrationCost(
  event: Event,
  rawTier?: string,
): CitedRegistrationCost | null {
  const tier: PlanTier = normalizeTier(rawTier);
  return citedCostForTier(findEventTier(event, tier));
}
