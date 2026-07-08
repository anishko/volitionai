// STAGE: similarity ranking (LOCAL nomic-embed-text, $0). Ranks filtered
// candidates against the profile embedding so only the strongest finalists
// reach the cloud explainer. FAIL-OPEN: if embeddings error, we keep the
// filter order (ranking improves quality, it is not load-bearing for
// correctness) — same discipline as the Volition ideas ranker.
import { ollamaEmbed, OLLAMA_EMBED_MODEL } from "@/lib/ai/ollama";
import { CostMeter } from "@/lib/ai/cost";
import type { ScoredCandidate } from "./schema";
import type { NonprofitProfileForMatch } from "@/types";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const estTokens = (s: string) => Math.ceil(s.length / 4);

function profileText(p: NonprofitProfileForMatch): string {
  const causes = p.causeSubTags.length ? p.causeSubTags.join(", ") : p.causeAreas.join(", ");
  return `${p.orgName}. Cause focus: ${causes}. Geography: ${p.geographyFocus ?? "national"} ${p.geographyDetail ?? ""}. Seeking ${p.targetDonorType.join(", ")} donors. Goal: ${p.primaryGoal ?? ""}. ${p.openEndedNotes ?? ""}`;
}

export async function rankCandidates(
  meter: CostMeter,
  profile: NonprofitProfileForMatch,
  candidates: ScoredCandidate[],
  topN: number,
): Promise<{ ranked: ScoredCandidate[]; degraded: string[] }> {
  const degraded: string[] = [];
  if (candidates.length === 0) return { ranked: [], degraded };

  try {
    const started = Date.now();
    const pText = profileText(profile);
    const profileVec = await ollamaEmbed(pText);

    let tokens = estTokens(pText);
    const scored: ScoredCandidate[] = [];
    for (const c of candidates) {
      const text = `${c.event.name}. ${c.description}`;
      tokens += estTokens(text);
      const vec = await ollamaEmbed(text);
      scored.push({ ...c, similarity: cosine(profileVec, vec) });
    }

    meter.ollama({
      stage: "rank",
      model: OLLAMA_EMBED_MODEL,
      inputTokens: tokens,
      outputTokens: 0,
      latencyMs: Date.now() - started,
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return { ranked: scored.slice(0, topN), degraded };
  } catch (err) {
    console.warn(
      "[rank-events] embedding rank failed, keeping filter order:",
      err instanceof Error ? err.message : err,
    );
    degraded.push("Embedding ranking unavailable — candidates kept in filter order");
    return { ranked: candidates.slice(0, topN), degraded };
  }
}
