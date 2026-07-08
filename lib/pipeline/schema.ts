// Zod contracts for every model-produced payload. Types in /types are the
// human contract; these are the runtime enforcement. Parsing failures are
// caught by the orchestrator and turned into honest "some lanes unavailable"
// results rather than crashes.
import { z } from "zod";
import type { IdeaLane } from "@/types";

export const LANES = ["trend", "comparable", "opportunity", "law", "event", "donor"] as const;

export const ProfileSchema = z.object({
  businessName: z.string().min(1),
  orgType: z.string().min(1),
  industry: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  audience: z.string().default(""),
  goals: z.array(z.string()).default([]),
  voice: z.string().optional(),
  pastContentThemes: z.array(z.string()).optional(),
  issueAreas: z.array(z.string()).optional(),
  movementAlignment: z.string().optional(),
  geographicReach: z.array(z.string()).optional(),
  nonprofitType: z.string().optional(),
});

export const PlanSchema = z.object({
  queries: z.array(z.string().min(3)).min(1).max(10),
  lanes: z.array(z.enum(LANES)).min(1),
});
export type Plan = z.infer<typeof PlanSchema>;

export const EvidenceSchema = z.object({
  claim: z.string().min(1),
  url: z.string().url(),
  sourceName: z.string().min(1),
});

export const ComparableSchema = z.object({
  name: z.string().min(1),
  whyComparable: z.string().default(""),
  notablePlays: z.array(z.string()).default([]),
  url: z.string().url(),
});

// A card as the synthesis model returns it (no id / draftContent yet).
export const IdeaCardCoreSchema = z.object({
  lane: z.enum(LANES),
  idea: z.string().min(1),
  whyItFitsYou: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1), // citation-or-no-card, enforced structurally
  comparables: z.array(ComparableSchema).default([]),
  executionSteps: z.array(z.string()).min(1),
  confidence: z.enum(["high", "medium", "low"]),
  // Event-lane extras — model populates only when lane === "event"
  eventDates: z.string().optional(),
  eventLocation: z.string().optional(),
  knownPastSponsors: z.array(z.string()).optional(),
  organizerContact: z.string().optional(),
  sponsorCost: z.string().optional(),
  // Donor-lane extras — model populates only when lane === "donor"
  donorType: z.enum(["individual", "foundation", "pac", "corporate"]).optional(),
  approachAngle: z.string().optional(),
});
export type IdeaCardCore = z.infer<typeof IdeaCardCoreSchema>;

export const SynthesisSchema = z.object({
  cards: z.array(IdeaCardCoreSchema).default([]),
});

// JSON Schema handed to Anthropic structured outputs. Must use
// additionalProperties:false + explicit required, and NO numeric/length
// constraints (unsupported). Structural min-length is enforced by zod after.
export const SYNTHESIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "lane",
          "idea",
          "whyItFitsYou",
          "evidence",
          "comparables",
          "executionSteps",
          "confidence",
        ],
        properties: {
          lane: { type: "string", enum: LANES },
          idea: { type: "string" },
          whyItFitsYou: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["claim", "url", "sourceName"],
              properties: {
                claim: { type: "string" },
                url: { type: "string" },
                sourceName: { type: "string" },
              },
            },
          },
          comparables: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "whyComparable", "notablePlays", "url"],
              properties: {
                name: { type: "string" },
                whyComparable: { type: "string" },
                notablePlays: { type: "array", items: { type: "string" } },
                url: { type: "string" },
              },
            },
          },
          executionSteps: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          // Event-lane extras (optional — populate only when lane === "event")
          eventDates: { type: "string" },
          eventLocation: { type: "string" },
          knownPastSponsors: { type: "array", items: { type: "string" } },
          organizerContact: { type: "string" },
          sponsorCost: { type: "string" },
          // Donor-lane extras (optional — populate only when lane === "donor")
          donorType: { type: "string", enum: ["individual", "foundation", "pac", "corporate"] },
          approachAngle: { type: "string" },
        },
      },
    },
  },
};

export function isLane(x: string): x is IdeaLane {
  return (LANES as readonly string[]).includes(x);
}

// Human-readable current date, injected into prompts so the model grounds all
// timing in the present and never frames a past date as upcoming.
export function todayStr(): string {
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const d = new Date();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// Tolerant JSON extraction — strips code fences / stray prose that a local
// model may wrap around its JSON before we hand it to zod.
export function looseJsonParse(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("no JSON found in model output");
  }
}
