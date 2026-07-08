// Runtime contracts + shared constants for the Phase 2 event matching pipeline
// (docs/NONPROFIT_EVENTS_PRD.md → "Event matching pipeline"). Types in /types
// are the human contract; these zod schemas are the runtime enforcement. Date
// grounding + tolerant JSON parsing are reused from the Volition ideas pipeline
// so both pipelines ground timing identically.
import { z } from "zod";
import { looseJsonParse, todayStr } from "@/lib/pipeline/schema";
import type { EventWithRoi, NonprofitProfileForMatch } from "@/types";

export { looseJsonParse, todayStr };

// ---------------------------------------------------------------------------
// CorpusEvent — the single candidate representation threaded through filter →
// rank → explain → validate. Wraps a frozen EventWithRoi with the free-text
// used for embedding/explanation and the set of URLs a claim about this event
// is allowed to cite. Built centrally so every source (seed CSV, Firecrawl,
// Tavily, Meetup/Luma) is normalized the same way.
// ---------------------------------------------------------------------------
export interface CorpusEvent {
  event: EventWithRoi;
  description: string;    // free text for embeddings + explainer context
  citationUrls: string[]; // allowed source URLs for this event's claims (validator gate)
}

/** A candidate that survived the rules filter, carrying the honest reasons it
 *  survived and (after ranking) its similarity score. */
export interface ScoredCandidate extends CorpusEvent {
  reasons: import("@/types").MatchCandidateReason[];
  similarity: number;     // 0-1 cosine vs profile; 0 when ranking unavailable
}

/** Every URL a claim about this event may cite: the event website plus every
 *  nested sourceUrl already attached to its sourced fields, plus any extras. */
export function collectCitationUrls(e: EventWithRoi, extra: string[] = []): string[] {
  const urls = new Set<string>();
  const add = (u?: string) => {
    if (u && /^https?:\/\//.test(u)) urls.add(u);
  };
  add(e.website);
  e.speakers.forEach((s) => add(s.sourceUrl));
  e.sponsors.forEach((s) => add(s.sourceUrl));
  e.organizerContacts.forEach((c) => add(c.sourceUrl));
  e.participationTiers.forEach((t) => add(t.sourceUrl));
  e.donorSignals.forEach((d) => {
    add(d.filingUrl);
    add(d.eventSourceUrl);
  });
  e.certificatesOffered.forEach((c) => add(c.sourceUrl));
  extra.forEach(add);
  return [...urls];
}

/** Default free-text description from event fields when a richer one (CSV
 *  blurb, scrape markdown, search snippet) isn't supplied. */
function defaultDescription(e: EventWithRoi): string {
  const loc = [e.locationCity, e.locationState, e.locationCountry].filter(Boolean).join(", ");
  const parts = [
    e.name,
    e.causeAreaTags.join(", "),
    e.causeSubTags.join(", "),
    loc,
    e.format,
    e.sponsors.map((s) => s.name).join(", "),
  ].filter((p) => p && p.length > 0);
  return parts.join(". ");
}

export function toCorpusEvent(e: EventWithRoi, description?: string, extraUrls: string[] = []): CorpusEvent {
  return {
    event: e,
    description: description && description.trim().length > 0 ? description : defaultDescription(e),
    citationUrls: collectCitationUrls(e, extraUrls),
  };
}

// --- Budget caps (Volition rule: hard-stopped in code, logged on the receipt).
export const TAVILY_CREDIT_CAP = 20;   // per match run — PRD "Budget caps"
export const FIRECRAWL_PAGE_CAP = 15;  // per match run — PRD "Budget caps"
export const FINALIST_CAP = 15;        // top candidates that reach cloud explanation (PRD: 10-20)
export const MIN_MATCH_SCORE = 55;     // floor for a returned match — PRD: never pad the feed with weak matches

// --- Query planner (LOCAL qwen3:8b, think:false) ---------------------------
export const EventQueryPlanSchema = z.object({
  queries: z.array(z.string().min(3)).min(1).max(10),
});
export type EventQueryPlan = z.infer<typeof EventQueryPlanSchema>;

// --- Firecrawl structured extraction (LOCAL qwen3 over scraped markdown) ----
// The model only proposes field VALUES; source_url + scraped_at/verified_at are
// stamped by code (the page the value came from), never by the model.
export const ScrapedEventSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),      // ISO date or null-ish; validated downstream
  endDate: z.string().optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  locationCountry: z.string().optional(),
  format: z.enum(["in_person", "virtual", "hybrid"]).optional(),
  causeAreaTags: z.array(z.string()).default([]),
  participationTiers: z
    .array(
      z.object({
        tier: z.string().min(1),
        cost: z.string().optional(),
        deadline: z.string().optional(),
        applyUrl: z.string().optional(),
        instructions: z.string().optional(),
      }),
    )
    .default([]),
  speakers: z
    .array(z.object({ name: z.string().min(1), title: z.string().optional(), org: z.string().optional() }))
    .default([]),
  sponsors: z.array(z.object({ name: z.string().min(1) })).default([]),
  organizerContacts: z
    .array(z.object({ name: z.string().min(1), role: z.string().optional(), email: z.string().optional() }))
    .default([]),
  certificatesOffered: z.array(z.object({ type: z.string().min(1) })).default([]),
});
export type ScrapedEvent = z.infer<typeof ScrapedEventSchema>;

// --- Match explainer (CLOUD claude-haiku, structured output) ----------------
export const MatchExplanationSchema = z.object({
  eventId: z.string().min(1),
  matchScore: z.number(),                // clamped to 0-100 by code
  whyAttend: z.string().min(1),
  donorSignalCallout: z.string().optional(),
  evidence: z
    .array(z.object({ claim: z.string().min(1), sourceUrl: z.string().min(1) }))
    .default([]),
});
export const MatchExplanationsSchema = z.object({
  explanations: z.array(MatchExplanationSchema).default([]),
});
export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;

// JSON Schema handed to Anthropic structured outputs. Rules (per anthropic.ts):
// additionalProperties:false + explicit required, NO numeric/length constraints.
export const MATCH_EXPLANATIONS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["explanations"],
  properties: {
    explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventId", "matchScore", "whyAttend", "donorSignalCallout", "evidence"],
        properties: {
          eventId: { type: "string" },
          matchScore: { type: "number" },
          whyAttend: { type: "string" },
          donorSignalCallout: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claim", "sourceUrl"],
              properties: {
                claim: { type: "string" },
                sourceUrl: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// TEST_PROFILE — design partner #2 ("Fourth Amendment Defense Project"). Used
// by scripts/test-match.ts and any pipeline path lacking a real profile. This
// is the ONE hardcoded seam; wire real DB profiles in via profileRowToMatch()
// (lib/signals/profile-adapter.ts) so nothing else in the pipeline changes.
// ---------------------------------------------------------------------------
export const TEST_PROFILE: NonprofitProfileForMatch = {
  id: "test-profile-4adp",
  userId: "test-user",
  orgName: "Fourth Amendment Defense Project",
  website: "https://example.org/4adp",
  causeAreas: ["civil liberties / government accountability"],
  causeSubTags: [
    "criminal legal reform",
    "fourth amendment / over-policing",
    "exoneration",
    "eminent domain",
    "homeless defense",
  ],
  geographyFocus: "national",
  geographyDetail: "United States; strongest donor base in the South and Mountain West",
  orgSize: "under $500k",              // budget-sensitive → virtual events first-class
  annualBudgetCap: 40000,
  budgetPeriod: "2027",
  currentDonorMix: ["individual", "foundation"],
  targetDonorType: ["foundation", "corporate"],
  primaryGoal: "land foundation grants",
  openEndedNotes:
    "We plan our whole year against a fixed conference budget and must justify each trip to our board. " +
    "Certificates / CE credit matter. We value issue-aligned convenings on policing, criminal legal reform, " +
    "and property-rights / eminent-domain, and treat virtual events as first-class when budget is tight.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Liberty Legal Aid — the wedge persona used for the live DB acceptance run.
// Deliberately named as TEST data (org name + the test-pipeline@ user) so the
// persisted rows are unmistakable in the dashboard and easy to clean up later.
export const LIBERTY_LEGAL_AID_PROFILE: NonprofitProfileForMatch = {
  id: "test-profile-liberty-legal-aid",   // replaced with the real DB uuid at run time
  userId: "test-user",
  orgName: "TEST — Liberty Legal Aid (pipeline acceptance)",
  website: "https://example.org/liberty-legal-aid",
  causeAreas: ["civil liberties / government accountability"],
  causeSubTags: ["child welfare", "eminent domain", "homeless defense"],
  geographyFocus: "national",
  geographyDetail: "United States; donor base concentrated in the South and Mountain West",
  orgSize: "under $500k",
  annualBudgetCap: 15000,
  budgetPeriod: "2027",
  currentDonorMix: ["individual", "foundation"],
  targetDonorType: ["foundation", "corporate"],
  primaryGoal: "land foundation grants",
  openEndedNotes:
    "National government-accountability nonprofit litigating child welfare, eminent-domain, and " +
    "homeless-defense cases. Hard annual conference budget; every trip is justified to a board. " +
    "Certificates / CE credit valued; virtual events are first-class under budget pressure.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Clamp a model-proposed score into the 0-100 contract (match_score check). */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
