// STAGE: rank. Dedupe by URL then return the top N by fetch order.
import { CostMeter } from "@/lib/ai/cost";
import type { Evidence } from "@/lib/data/tavily";
import type { BusinessProfile } from "@/types";

export async function rankEvidence(
  _meter: CostMeter,
  _profile: BusinessProfile,
  evidence: Evidence[],
  topN = 12,
): Promise<Evidence[]> {
  const byUrl = new Map<string, Evidence>();
  for (const e of evidence) if (!byUrl.has(e.url)) byUrl.set(e.url, e);
  const unique = [...byUrl.values()];
  return unique.slice(0, topN);
}
