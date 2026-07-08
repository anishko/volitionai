import { tavilySearch } from "@/lib/data/tavily";
import { anthropicMessage } from "@/lib/ai/anthropic";
import { CostMeter } from "@/lib/ai/cost";
import { looseJsonParse } from "@/lib/pipeline/schema";
import type { NonprofitProfile } from "@/types";
import type { PeerOrg } from "@/types/peer";

const PEER_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["peers"],
  properties: {
    peers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "website",
          "description",
          "causeAreas",
          "location",
          "strategy",
          "partnerships",
          "sourceUrl",
          "relevanceReason",
        ],
        properties: {
          name: { type: "string" },
          website: { type: "string" },
          description: { type: "string" },
          causeAreas: { type: "array", items: { type: "string" } },
          location: { type: "string" },
          strategy: { type: "string" },
          partnerships: { type: "array", items: { type: "string" } },
          sourceUrl: { type: "string" },
          relevanceReason: { type: "string" },
        },
      },
    },
  },
};

function buildQueries(profile: NonprofitProfile): string[] {
  const causes = profile.causeAreas.slice(0, 3).join(" ");
  const geo = profile.geographyDetail ?? profile.geographyFocus ?? "";
  const size = profile.orgSize ?? "";
  const goal = profile.primaryGoal ?? "";

  return [
    `organizations similar to "${profile.orgName}" ${causes} ${geo} partnerships sponsors`,
    `comparable nonprofits ${causes} ${geo} strategy partnerships`,
    `${causes} ${size} organizations ${goal} peer analysis`.trim(),
  ];
}

export async function analyzePeers(
  meter: CostMeter,
  profile: NonprofitProfile,
): Promise<PeerOrg[]> {
  const queries = buildQueries(profile);

  const searchOutcomes = await Promise.allSettled(
    queries.map((q) => tavilySearch(q, 8)),
  );

  const snippets: string[] = [];
  let totalLatency = 0;
  let searchCount = 0;
  for (const outcome of searchOutcomes) {
    if (outcome.status !== "fulfilled") continue;
    totalLatency += outcome.value.latencyMs;
    searchCount++;
    for (const r of outcome.value.results) {
      snippets.push(`URL: ${r.url}\nTITLE: ${r.title}\n${r.snippet}`);
    }
  }
  if (searchCount > 0) {
    meter.tavily({ stage: "search", searches: searchCount, latencyMs: totalLatency });
  }

  if (snippets.length === 0) return [];

  const system = `You identify peer organizations comparable to the target org from web search snippets.
Return structured JSON only — no commentary. Each peer must be grounded in the provided search results.`;

  const prompt = `TARGET ORG: ${profile.orgName}
Cause areas: ${profile.causeAreas.join(", ")}
Geography: ${profile.geographyDetail ?? profile.geographyFocus ?? "unspecified"}
Size: ${profile.orgSize ?? "unspecified"}
Goal: ${profile.primaryGoal ?? "unspecified"}

SEARCH RESULTS (${snippets.length} snippets):
${snippets.join("\n\n---\n\n")}

Identify up to 10 peer organizations from the search results that are comparable to the target org.
For each, extract:
- name: full organization name
- website: their website URL if found, otherwise empty string
- description: 2-3 sentence summary of what they do
- causeAreas: 1-5 topic tags
- location: city/region or "National" / "International" as appropriate
- strategy: 1-2 sentences on their key operating strategy or model that peer orgs could learn from
- partnerships: list of known corporate partners, sponsors, or major funders found in the snippets (empty array if none cited)
- sourceUrl: the URL from search results where this org appeared
- relevanceReason: one sentence on why they are comparable to ${profile.orgName}`;

  const r = await anthropicMessage({
    system,
    prompt,
    jsonSchema: PEER_JSON_SCHEMA,
    maxTokens: 4000,
  });
  meter.anthropic({
    stage: "synthesize",
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    latencyMs: r.latencyMs,
  });

  try {
    const parsed = looseJsonParse(r.text) as { peers?: unknown[] };
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.peers)
        ? parsed.peers
        : [];
    return (arr as Partial<PeerOrg>[]).slice(0, 10).map((p) => ({
      name: String(p.name ?? "Unknown"),
      website: String(p.website ?? ""),
      description: String(p.description ?? ""),
      causeAreas: Array.isArray(p.causeAreas) ? (p.causeAreas as string[]) : [],
      location: String(p.location ?? ""),
      strategy: String(p.strategy ?? ""),
      partnerships: Array.isArray(p.partnerships) ? (p.partnerships as string[]) : [],
      sourceUrl: String(p.sourceUrl ?? ""),
      relevanceReason: String(p.relevanceReason ?? ""),
    }));
  } catch {
    console.error("[peers/analyze] failed to parse LLM output:", r.text.slice(0, 200));
    return [];
  }
}
