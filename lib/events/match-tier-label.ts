// Deterministic match-tier labels for honest UI (PR7 / ADR-0007).
import type { MatchTier } from "@/types";

export interface MatchTierLabel {
  short: string;
  tooltip: string;
}

const LABELS: Record<Exclude<MatchTier, "strict">, MatchTierLabel> = {
  geo_relaxed: {
    short: "Beyond your region",
    tooltip: "Matched on cause but outside your stated geography — we included it because exact local matches were thin.",
  },
  cause_broadened: {
    short: "Related causes",
    tooltip: "Broadened to adjacent or cross-sector events because there were not enough exact cause matches.",
  },
  virtual_floor: {
    short: "Virtual option",
    tooltip: "Included as an attendable virtual event when in-person matches were too thin.",
  },
};

export function matchTierLabel(tier: MatchTier): MatchTierLabel | null {
  if (tier === "strict") return null;
  return LABELS[tier];
}

export function feedBroadenedNotice(relaxed: boolean): string | null {
  if (!relaxed) return null;
  return "Not enough exact matches — we broadened to related causes or virtual options (labeled on each card).";
}
