// STAGE: rank. Local embeddings (nomic-embed-text, $0) score fetched evidence
// against the profile so synthesis sees the most relevant items first.
// FAIL-OPEN: if embeddings error, we fall back to fetch order rather than break
// the run — ranking improves quality, it is not load-bearing for correctness.
import { ollamaEmbed, OLLAMA_EMBED_MODEL } from "@/lib/ai/ollama";
import { CostMeter } from "@/lib/ai/cost";
import type { Evidence } from "@/lib/data/tavily";
import type { BusinessProfile } from "@/types";

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

export async function rankEvidence(
  meter: CostMeter,
  profile: BusinessProfile,
  evidence: Evidence[],
  topN = 12,
): Promise<Evidence[]> {
  // Dedupe by URL first (multiple queries often surface the same page).
  const byUrl = new Map<string, Evidence>();
  for (const e of evidence) if (!byUrl.has(e.url)) byUrl.set(e.url, e);
  const unique = [...byUrl.values()];
  if (unique.length <= topN) return unique;

  try {
    const started = Date.now();
    const profileText = `${profile.businessName}. ${profile.orgType}. Audience: ${profile.audience}. Goals: ${profile.goals.join(", ")}`;
    const profileVec = await ollamaEmbed(profileText);

    const scored: { e: Evidence; score: number }[] = [];
    let tokens = estTokens(profileText);
    for (const e of unique) {
      const text = `${e.title}. ${e.snippet}`;
      tokens += estTokens(text);
      const vec = await ollamaEmbed(text);
      scored.push({ e, score: cosine(profileVec, vec) });
    }

    meter.ollama({
      stage: "rank",
      model: OLLAMA_EMBED_MODEL,
      inputTokens: tokens,
      outputTokens: 0,
      latencyMs: Date.now() - started,
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map((s) => s.e);
  } catch (err) {
    console.warn(
      "[rank] embedding rank failed, using fetch order:",
      err instanceof Error ? err.message : err,
    );
    return unique.slice(0, topN);
  }
}
