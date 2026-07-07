// Zod contract for the onboarding form (docs/NONPROFIT_EVENTS_PRD.md,
// "Onboarding form"). Shared by the client form and POST /api/nonprofit/profile.
import { z } from "zod";

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

export const PRIMARY_GOALS = [
  { value: "grow_individual_donors", label: "Grow individual donors" },
  { value: "land_foundation_grants", label: "Land foundation grants" },
  { value: "find_corporate_sponsors", label: "Find corporate sponsors" },
  { value: "increase_visibility", label: "Increase visibility" },
  { value: "find_speaking_opportunities", label: "Find speaking opportunities" },
] as const;

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

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
  geographyDetail: z.string().trim().max(200).optional(),
  orgSize: z.enum(values(ORG_SIZES)),
  currentDonorMix: z.array(z.enum(values(DONOR_TYPES))).default([]),
  targetDonorType: z.array(z.enum(values(DONOR_TYPES))).min(1, "Pick at least one target donor type"),
  primaryGoal: z.enum(values(PRIMARY_GOALS)),
  openEndedNotes: z.string().trim().max(2000).optional(),
});

export type OnboardingForm = z.infer<typeof OnboardingFormSchema>;
