// STAGE: onboarding website enrichment. When a profile has a website, we scrape
// the org's own site (≤2 pages) and extract SUGGESTED profile fields the user
// will later confirm. Runs LOCAL-first (Ollama, $0) with a metered cloud
// fallback, mirroring lib/nonprofit/extract.ts. Scraped content is untrusted
// data (PRD rule 5) and the raw markdown is discarded after extraction (PRD
// rule 4) — only the structured envelope persists. Suggestions are stashed
// under extracted_profile.suggestedEnrichments and NEVER overwrite confirmed
// fields; matching does not read them (see MOCKED.md).
import { z } from "zod";

export const EnrichmentSuggestionsSchema = z.object({
  missionLanguage: z.string().default(""), // how THEY describe their mission
  programAreas: z.array(z.string()).default([]), // programs/initiatives named on the site
  namedSponsors: z.array(z.string()).default([]), // sponsors/funders/partners named on the site
  voiceTraits: z.array(z.string()).default([]), // tone/voice descriptors from their copy
});
export type EnrichmentSuggestions = z.infer<typeof EnrichmentSuggestionsSchema>;

export type EnrichmentOutcome =
  | { status: "ready"; fields: EnrichmentSuggestions; sourceUrls: string[] }
  | { status: "skipped" };

export interface EnrichmentEnvelope {
  status: "ready" | "skipped" | "failed";
  sourceUrls: string[];
  fields?: EnrichmentSuggestions;
  generatedAt: string;
}

/** Homepage + /about (attempted, not verified), deduped, capped at 2 (budget). */
export function deriveEnrichmentUrls(website: string): string[] {
  let origin: string;
  let homepage: string;
  try {
    const u = new URL(website);
    if (u.protocol !== "http:" && u.protocol !== "https:") return [];
    origin = u.origin;
    homepage = `${origin}/`;
  } catch {
    return [];
  }
  const about = `${origin}/about`;
  const urls = [homepage, about].filter((u, i, a) => a.indexOf(u) === i);
  return urls.slice(0, 2);
}

/** Terminal envelope. Fail-closed: only "ready" carries fields; others are empty. */
export function buildEnrichmentEnvelope(
  input: EnrichmentOutcome | { status: "failed" },
  generatedAt: string,
): EnrichmentEnvelope {
  if (input.status === "ready") {
    return {
      status: "ready",
      sourceUrls: input.sourceUrls,
      fields: input.fields,
      generatedAt,
    };
  }
  return { status: input.status, sourceUrls: [], generatedAt };
}
