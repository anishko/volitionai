// STAGE: synthesize. The one quality-critical, cloud step. Turns ranked
// evidence into IdeaCards under hard rules: every card must cite >=1 URL that
// appears in the provided evidence set (never invented). The validator enforces
// this mechanically afterward — the prompt just makes compliance likely.
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import {
  SynthesisSchema,
  SYNTHESIS_JSON_SCHEMA,
  looseJsonParse,
  todayStr,
  type IdeaCardCore,
  type Plan,
} from "./schema";
import type { Evidence } from "@/lib/data/tavily";
import type { BusinessProfile } from "@/types";

const SYSTEM = `You are an insights analyst producing execution-ready idea cards for a specific organization.
HARD RULES (a card that breaks any rule will be discarded):
1. Every card's "evidence" must cite at least one URL, and every cited URL MUST be copied verbatim from the EVIDENCE list provided. Never invent, guess, or modify a URL.
2. If a lane has no supporting evidence, return NO card for that lane. Fewer real cards beats padded ones.
3. "idea" is one concrete sentence. "whyItFitsYou" ties it to THIS org's profile. "executionSteps" are 2-4 concrete actions.
4. For "comparable" lane cards, populate "comparables" (name + whyComparable + notablePlays + the source url). Other lanes: use an empty array.
5. Output JSON only, matching the required schema. Set "confidence" to high/medium/low based on how directly the evidence supports the idea.
6. DATE GROUNDING: today's date is provided below. Reference only present or future timeframes. Never describe a date that has already passed as upcoming; if the evidence only mentions a past occurrence of a recurring event, refer to its next/annual cycle generically (e.g. "its annual spring conference") rather than stating a specific past date as if it were ahead.
7. EVENTS FOR FUNDRAISING/SPONSORS/DONORS: when the profile's goals include fundraising, sponsors, donors, or events, opportunity-lane cards should surface specific NAMED events/conferences. For each named event, include in the idea/whyItFitsYou/executionSteps whichever of these are CITABLE from the evidence: annual timing, issue-area fit, known past sponsors, organizer contact or contact path, and prior media coverage. Each such field must be cited (its URL in the card's evidence) or omitted entirely — never guess a date, sponsor, or contact.
8. EVENT LANE: Produce one card naming a SPECIFIC upcoming event or annual conference. Populate the optional fields from evidence only: eventDates as "annual [month/season] cycle" if the evidence only shows a past occurrence — never a specific past date; eventLocation from evidence; knownPastSponsors as a list only if named in evidence; organizerContact only if a contact path is in evidence; sponsorCost only if a number or range is cited. Leave any field blank rather than guessing.
9. DONOR LANE: Produce one card naming a foundation, donor category, or specific major donor. Populate donorType (individual/foundation/pac/corporate) and approachAngle (a concrete first-contact step, e.g. "submit letter of inquiry via [foundation] grant portal") from evidence. Cite the 990 data URL, foundation website, or FEC filing that supports each claim.`;

function buildPrompt(
  profile: BusinessProfile,
  evidence: Evidence[],
  lanes: Plan["lanes"],
): string {
  const evidenceBlock = evidence
    .map(
      (e, i) =>
        `[${i + 1}] ${e.title}\nURL: ${e.url}\nSNIPPET: ${e.snippet}${e.publishedAt ? `\nDATE: ${e.publishedAt}` : ""}`,
    )
    .join("\n\n");

  const nonprofitExtras: string[] = [];
  if (profile.issueAreas?.length) nonprofitExtras.push(`issueAreas: ${profile.issueAreas.join(", ")}`);
  if (profile.movementAlignment) nonprofitExtras.push(`movementAlignment: ${profile.movementAlignment}`);
  if (profile.geographicReach?.length) nonprofitExtras.push(`geographicReach: ${profile.geographicReach.join(", ")}`);
  if (profile.nonprofitType) nonprofitExtras.push(`nonprofitType: ${profile.nonprofitType}`);

  return `TODAY'S DATE: ${todayStr()} (reference only present or future timeframes).

ORGANIZATION PROFILE:
name: ${profile.businessName}
orgType: ${profile.orgType} | industry: ${profile.industry}
location: ${profile.city}, ${profile.state}
audience: ${profile.audience}
goals: ${profile.goals.join("; ")}
voice: ${profile.voice ?? "(unknown)"}${nonprofitExtras.length ? "\n" + nonprofitExtras.join("\n") : ""}

TARGET LANES: ${lanes.join(", ")}

EVIDENCE (cite ONLY these URLs, verbatim):
${evidenceBlock}

Produce up to one strong card per target lane where the evidence supports it. Return JSON now.`;
}

export interface SynthesisOutput {
  cards: IdeaCardCore[];
  model: string;
}

export async function synthesize(
  meter: CostMeter,
  profile: BusinessProfile,
  evidence: Evidence[],
  lanes: Plan["lanes"],
): Promise<SynthesisOutput> {
  const r = await anthropicMessage({
    system: SYSTEM,
    prompt: buildPrompt(profile, evidence, lanes),
    jsonSchema: SYNTHESIS_JSON_SCHEMA,
    maxTokens: 8000,
  });
  meter.anthropic({
    stage: "synthesize",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });

  const parsed = SynthesisSchema.parse(looseJsonParse(r.text));
  return { cards: parsed.cards, model: r.model };
}
