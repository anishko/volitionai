export interface BusinessProfile {
  businessName: string;
  orgType: string;             // "cafe", "student trading club", "sports team"...
  industry: string;
  city: string;
  state: string;
  audience: string;            // who they serve, in the owner's words
  goals: string[];             // e.g. ["find sponsors", "more foot traffic"]
  voice?: string;              // tone extracted from uploaded past content
  pastContentThemes?: string[];
}

export type IdeaLane = "trend" | "comparable" | "opportunity" | "law";

export interface Evidence {
  claim: string;               // the specific fact this idea rests on
  url: string;                 // REQUIRED — no citation, no card
  sourceName: string;
}

export interface Comparable {
  name: string;
  whyComparable: string;
  notablePlays: string[];      // sponsors, channels, tactics observed
  url: string;
}

export interface IdeaCard {
  id: string;
  lane: IdeaLane;
  idea: string;                // one concrete sentence
  whyItFitsYou: string;        // reasoning tied to the profile
  evidence: Evidence[];        // min length 1 — enforce in API route
  comparables?: Comparable[];  // populated for "comparable" lane
  executionSteps: string[];    // 2-4 concrete steps
  confidence: "high" | "medium" | "low";
  draftContent?: string;       // filled by "draft it" in org voice
  isSample?: boolean;          // true = mocked; UI must show a label
}
