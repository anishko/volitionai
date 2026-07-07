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
5. Output JSON only, matching the required schema. Set "confidence" to high/medium/low based on how directly the evidence supports the idea.`;

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

  return `ORGANIZATION PROFILE:
name: ${profile.businessName}
orgType: ${profile.orgType} | industry: ${profile.industry}
location: ${profile.city}, ${profile.state}
audience: ${profile.audience}
goals: ${profile.goals.join("; ")}
voice: ${profile.voice ?? "(unknown)"}

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
