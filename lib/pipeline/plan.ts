// STAGE: query planning. Turns the profile + goals into a small set of
// concrete web-search queries and picks which idea lanes to pursue.
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import { PlanSchema, looseJsonParse, todayStr, type Plan } from "./schema";
import type { BusinessProfile } from "@/types";

const SYSTEM = `You are a research planner. Given an organization profile, produce web-search
queries that will surface CITED evidence for concrete, execution-ready ideas.
Lanes:
- "comparable": what similar orgs actually do (sponsors, channels, tactics, plays)
- "opportunity": specific leads, timing, channels, sponsor categories, outreach angles
- "trend": what content/formats/topics are rising for this audience right now
- "law": (only if clearly relevant) rules that can be used as an angle
- "event": specific named conferences, conventions, or annual summits by issue area.
  Queries must name the issue area AND seek event listings, past sponsor lists, or registration pages.
  Example: "child welfare advocacy conference 2026 sponsor" or "libertarian annual summit nonprofit registration".
  Only include this lane when the profile has fundraising, sponsorship, or event goals.
- "donor": foundations, individual major donors, or PACs that fund orgs aligned to this movement/issue.
  Queries should search by movement alignment + issue area: "liberty movement foundation grants civil liberties",
  "IRS 990 foundations funding child advocacy nonprofits", "donors eminent domain property rights advocacy".
  Only include this lane when the profile is a nonprofit or advocacy org with fundraising goals.
Return ONLY JSON: {"queries": string[], "lanes": string[]}.
6-10 queries, each specific and searchable (include issue areas, movement alignment, and location when useful).
Choose 2-4 lanes. Include "event" and/or "donor" only when the profile signals a nonprofit with fundraising goals.`;

function buildPrompt(p: BusinessProfile): string {
  const extras: string[] = [];
  if (p.issueAreas?.length) extras.push(`issueAreas: ${p.issueAreas.join(", ")}`);
  if (p.movementAlignment) extras.push(`movementAlignment: ${p.movementAlignment}`);
  if (p.geographicReach?.length) extras.push(`geographicReach: ${p.geographicReach.join(", ")}`);
  if (p.nonprofitType) extras.push(`nonprofitType: ${p.nonprofitType}`);

  return `TODAY'S DATE: ${todayStr()}. Bias queries toward current and upcoming timeframes; do not search for events or seasons that have already passed.

PROFILE:
name: ${p.businessName}
orgType: ${p.orgType}
industry: ${p.industry}
location: ${p.city}, ${p.state}
audience: ${p.audience}
goals: ${p.goals.join("; ")}${extras.length ? "\n" + extras.join("\n") : ""}

Return the JSON plan now.`;
}

export async function planQueries(
  meter: CostMeter,
  profile: BusinessProfile,
): Promise<Plan> {
  const prompt = buildPrompt(profile);

  const r = await anthropicMessage({ system: SYSTEM, prompt, maxTokens: 800 });
  meter.anthropic({
    stage: "plan",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });
  return PlanSchema.parse(looseJsonParse(r.text));
}
