// Zod contract for the onboarding form (docs/NONPROFIT_EVENTS_PRD.md,
// "Onboarding form"). Shared by the client form and POST /api/nonprofit/profile.
import { z } from "zod";
import { REGION_VALUES } from "./region-options";

// PRD vocabulary. The issue lists seven + other; the PRD adds civil liberties
// (the wedge segment must not have to pick "other") and faith-based.
export const CAUSE_AREAS = [
  { value: "education", label: "Education" },
  { value: "environment", label: "Environment" },
  { value: "health", label: "Health" },
  { value: "housing", label: "Housing" },
  { value: "youth", label: "Youth" },
  { value: "arts", label: "Arts" },
  { value: "human_services", label: "Human services" },
  { value: "civil_liberties", label: "Civil liberties / government accountability" },
  { value: "faith_based", label: "Faith-based" },
  { value: "other", label: "Other" },
] as const;

export const GEOGRAPHY_FOCUS = [
  { value: "local", label: "Local" },
  { value: "regional", label: "Regional" },
  { value: "national", label: "National" },
  { value: "international", label: "International" },
] as const;

export const ORG_SIZES = [
  { value: "under $500k", label: "Under $500k" },
  { value: "$500k-$2M", label: "$500k - $2M" },
  { value: "$2M-$10M", label: "$2M - $10M" },
  { value: "$10M+", label: "$10M+" },
] as const;

export const DONOR_TYPES = [
  { value: "individual", label: "Individual donors" },
  { value: "foundation", label: "Foundations" },
  { value: "corporate", label: "Corporate sponsors" },
  { value: "government", label: "Government grants" },
] as const;

// Civil-liberties cause sub-taxonomy (amendment #2). Revealed when the
// "civil_liberties" cause area is selected; the matcher filters on sub-tags
// when present. Stored in nonprofit_profiles.cause_sub_tags.
export const CAUSE_SUB_TAGS = [
  { value: "criminal legal reform", label: "Criminal legal reform" },
  { value: "child welfare", label: "Child welfare" },
  { value: "fourth amendment / over-policing", label: "Fourth amendment / over-policing" },
  { value: "exoneration", label: "Exoneration" },
  { value: "eminent domain", label: "Eminent domain" },
  { value: "homeless defense", label: "Homeless defense" },
] as const;

export const PRIMARY_GOALS = [
  { value: "grow_individual_donors", label: "Grow individual donors" },
  { value: "land_foundation_grants", label: "Land foundation grants" },
  { value: "find_corporate_sponsors", label: "Find corporate sponsors" },
  { value: "increase_visibility", label: "Increase visibility" },
  { value: "find_speaking_opportunities", label: "Find speaking opportunities" },
] as const;

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const usCityValue = z
  .string()
  .regex(/^[^,]+,\s[A-Z]{2}$/, "Pick a U.S. city from the list (e.g. “Atlanta, GA”)");

export const OnboardingFormSchema = z.object({
  orgName: z.string().trim().min(2, "Org name is required"),
  website: z
    .string()
    .trim()
    .url("Enter a full URL (https://...)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  causeAreas: z.array(z.enum(values(CAUSE_AREAS))).min(1, "Pick at least one cause area"),
  geographyFocus: z.enum(values(GEOGRAPHY_FOCUS)),
  geographyDetail: usCityValue.optional().or(z.literal("").transform(() => undefined)),
  headquarters: usCityValue.optional().or(z.literal("").transform(() => undefined)),
  citiesOfInterest: z.array(usCityValue).max(12).default([]),
  regionsOfInterest: z.array(z.enum(REGION_VALUES)).max(12).default([]),
  orgSize: z.enum(values(ORG_SIZES)),
  currentDonorMix: z.array(z.enum(values(DONOR_TYPES))).default([]),
  targetDonorType: z.array(z.enum(values(DONOR_TYPES))).min(1, "Pick at least one target donor type"),
  primaryGoal: z.enum(values(PRIMARY_GOALS)),
  openEndedNotes: z.string().trim().max(2000).optional(),
  causeSubTags: z.array(z.string().trim().min(1)).max(12).default([]),
  qualitativeSignals: z.string().trim().max(2000).optional(),
});

export type OnboardingForm = z.infer<typeof OnboardingFormSchema>;

// Partial shape for incremental profile edits (e.g. future /profile page).
export const PartialOnboardingSchema = OnboardingFormSchema.partial();
export type PartialOnboarding = z.infer<typeof PartialOnboardingSchema>;
