// STAGE: match explanation (CLOUD claude-haiku-4-5). The one quality-critical,
// paid stage: turns ranked finalists into profile-aware "why attend" copy with
// an evidence array. HARD RULE (mirrored by the validator that runs after):
// every cited sourceUrl MUST be one of the URLs provided for that event —
// never invented. The prompt makes compliance likely; lib/validate.ts makes it
// certain. Date-grounded like every Volition explanation prompt.
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import {
  MatchExplanationsSchema,
  MATCH_EXPLANATIONS_JSON_SCHEMA,
  looseJsonParse,
  todayStr,
  type MatchExplanation,
  type ScoredCandidate,
} from "./schema";
import type { NonprofitProfileForMatch } from "@/types";

const SYSTEM = `You are a nonprofit development strategist writing why a specific org should attend specific events.
For EACH event you are given, produce one explanation object with:
- "matchScore": 0-100, how well this event fits THIS org's cause, geography, donor goals, and budget posture.
- "whyAttend": 2-3 sentences, specific to this org — name the cause fit and the donor/relationship opportunity.
- "donorSignalCallout": one sentence ONLY if the event data includes a donor/foundation signal; else omit.
- "evidence": array of {claim, sourceUrl}. Each claim is a specific fact your explanation rests on.

HARD RULES (violations are discarded by a downstream validator):
1. Every "sourceUrl" MUST be copied verbatim from the ALLOWED SOURCE URLS listed for that event. Never invent, guess, or modify a URL.
2. Include at least one evidence item per event, or the event is dropped. If you cannot cite it, do not claim it.
3. Do not state a specific date, cost, contact, or sponsor unless it appears in the event data provided.
4. DATE GROUNDING: today's date is given. Reference only present/future timeframes; never describe a past date as upcoming.
5. Output JSON only, matching the schema: {"explanations": [{eventId, matchScore, whyAttend, donorSignalCallout, evidence}]}.`;

function candidateBlock(c: ScoredCandidate): string {
  const e = c.event;
  const loc = [e.locationCity, e.locationState, e.locationCountry].filter(Boolean).join(", ") || "location not stated";
  const dates = e.startDate ? `${e.startDate}${e.endDate ? `–${e.endDate}` : ""}` : "dates not stated";
  const tags = [...e.causeAreaTags, ...e.causeSubTags].join(", ") || "none tagged";
  const donor =
    e.donorSignals.length > 0
      ? e.donorSignals.map((d) => `${d.foundationName} (990: ${d.filingUrl}; on event page: ${d.eventSourceUrl})`).join("; ")
      : "none";
  const certs = e.certificatesOffered.map((x) => x.type).join(", ") || "none";
  return `EVENT id=${e.id}
name: ${e.name}
website: ${e.website}
dates: ${dates} | location: ${loc} | format: ${e.format ?? "not stated"}
cause tags: ${tags}
certificates/CE: ${certs}
donor signals: ${donor}
context: ${c.description}
ALLOWED SOURCE URLS (cite ONLY these, verbatim):
${c.citationUrls.map((u) => `- ${u}`).join("\n")}`;
}

function buildPrompt(profile: NonprofitProfileForMatch, candidates: ScoredCandidate[]): string {
  const causes = profile.causeSubTags.length ? profile.causeSubTags.join(", ") : profile.causeAreas.join(", ");
  const budget =
    typeof profile.annualBudgetCap === "number"
      ? `Hard annual conference budget cap of $${profile.annualBudgetCap.toLocaleString()} for ${profile.budgetPeriod ?? "the year"} — budget-sensitive; certificates/CE credit and virtual events are valued.`
      : `Org size: ${profile.orgSize ?? "unknown"}.`;
  return `TODAY'S DATE: ${todayStr()} (reference only present/future timeframes).

ORGANIZATION:
name: ${profile.orgName}
cause focus: ${causes}
geography: ${profile.geographyFocus ?? "national"}${profile.geographyDetail ? ` — ${profile.geographyDetail}` : ""}
donor goals: wants more ${profile.targetDonorType.join(", ")}; primary goal: ${profile.primaryGoal ?? "grow funding"}
budget posture: ${budget}

CANDIDATE EVENTS:
${candidates.map(candidateBlock).join("\n\n")}

Return one explanation per event, JSON only.`;
}

export interface ExplainResult {
  explanations: MatchExplanation[];
  model: string;
}

export async function explainMatches(
  meter: CostMeter,
  profile: NonprofitProfileForMatch,
  candidates: ScoredCandidate[],
): Promise<ExplainResult> {
  if (candidates.length === 0) return { explanations: [], model: "" };

  const r = await anthropicMessage({
    system: SYSTEM,
    prompt: buildPrompt(profile, candidates),
    jsonSchema: MATCH_EXPLANATIONS_JSON_SCHEMA,
    maxTokens: 8000,
  });
  meter.anthropic({
    stage: "event_match",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });

  const parsed = MatchExplanationsSchema.parse(looseJsonParse(r.text));
  return { explanations: parsed.explanations, model: r.model };
}
