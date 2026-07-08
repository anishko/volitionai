// Mapping between the nonprofit_profiles table (snake_case) and the
// app-facing NonprofitProfile contract (camelCase, types/index.ts).
import type { NonprofitProfile } from "@/types";

export interface NonprofitProfileRow {
  id: string;
  user_id: string;
  org_name: string;
  website: string | null;
  cause_areas: string[];
  geography_focus: NonprofitProfile["geographyFocus"] | null;
  geography_detail: string | null;
  headquarters: string | null;
  cities_of_interest: string[];
  regions_of_interest: string[];
  areas_of_interest: string | null;
  org_size: string | null;
  current_donor_mix: string[];
  target_donor_type: string[];
  primary_goal: string | null;
  open_ended_notes: string | null;
  extracted_profile: Record<string, unknown> | null;
  voice_profile: Record<string, unknown> | null;
  internal_facts: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function rowToNonprofitProfile(row: NonprofitProfileRow): NonprofitProfile {
  return {
    id: row.id,
    userId: row.user_id,
    orgName: row.org_name,
    website: row.website ?? undefined,
    causeAreas: row.cause_areas ?? [],
    geographyFocus: row.geography_focus ?? undefined,
    geographyDetail: row.geography_detail ?? undefined,
    headquarters: row.headquarters ?? undefined,
    citiesOfInterest: row.cities_of_interest ?? [],
    regionsOfInterest: row.regions_of_interest ?? [],
    areasOfInterest: row.areas_of_interest ?? undefined,
    orgSize: row.org_size ?? undefined,
    currentDonorMix: row.current_donor_mix ?? [],
    targetDonorType: row.target_donor_type ?? [],
    primaryGoal: row.primary_goal ?? undefined,
    openEndedNotes: row.open_ended_notes ?? undefined,
    extractedProfile: row.extracted_profile ?? undefined,
    voiceProfile: row.voice_profile ?? undefined,
    internalFacts: row.internal_facts ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
