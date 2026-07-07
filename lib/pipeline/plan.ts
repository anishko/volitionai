// STAGE: query planning. Runs LOCAL ($0). Turns the profile + goals into a
// small set of concrete web-search queries and picks which idea lanes to pursue.
import { ollamaChat } from "@/lib/ai/ollama";
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import { PlanSchema, looseJsonParse, type Plan } from "./schema";
import type { BusinessProfile } from "@/types";

const SYSTEM = `You are a research planner. Given an organization profile, produce web-search
queries that will surface CITED evidence for concrete, execution-ready ideas.
Lanes:
- "comparable": what similar orgs actually do (sponsors, channels, tactics, plays)
- "opportunity": specific leads, timing, channels, sponsor categories, outreach angles
- "trend": what content/formats/topics are rising for this audience right now
- "law": (only if clearly relevant) rules that can be used as an angle
Return ONLY JSON: {"queries": string[], "lanes": string[]}.
6-8 queries, each specific and searchable (include the org type, audience, and place when useful).
Choose 2-3 lanes that the queries can actually support with public evidence.`;

function buildPrompt(p: BusinessProfile): string {
  return `PROFILE:
name: ${p.businessName}
orgType: ${p.orgType}
industry: ${p.industry}
location: ${p.city}, ${p.state}
audience: ${p.audience}
goals: ${p.goals.join("; ")}

Return the JSON plan now.`;
}

export async function planQueries(
  meter: CostMeter,
  profile: BusinessProfile,
): Promise<Plan> {
  const prompt = buildPrompt(profile);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await ollamaChat({ system: SYSTEM, prompt, json: true });
      meter.ollama({
        stage: "plan",
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        latencyMs: r.latencyMs,
      });
      return PlanSchema.parse(looseJsonParse(r.text));
    } catch (err) {
      if (attempt === 1) {
        console.warn(
          "[plan] Ollama planning failed, falling back to cloud:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

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
