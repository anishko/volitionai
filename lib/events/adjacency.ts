// Curated cause-adjacency map (ADR-0007): which cause areas count as
// "related" in the cascade's cause-broadened tier (ADR-0004). Deterministic
// on purpose - a match explanation must be able to state exactly why an
// adjacent-cause event was surfaced, which embedding similarity can't do.
// Keep pairings defensible: two causes are adjacent only when their orgs
// genuinely share event circuits, funders, or audiences.
//
// Vocabulary matches CAUSE_AREAS in lib/nonprofit/onboarding-schema.ts.
const CAUSE_ADJACENCY: Record<string, string[]> = {
  // Legal-aid, reentry, and housing-defense work overlaps human-services
  // orgs; religious-liberty groups share the advocacy and donor circuit.
  civil_liberties: ["human_services", "faith_based"],
  // Faith orgs deliver social services and fight religious-liberty battles.
  faith_based: ["human_services", "civil_liberties"],
  // Schools, afterschool, and youth-development share audiences and funders.
  education: ["youth"],
  // Youth programs live inside education and human-services ecosystems.
  youth: ["education", "human_services"],
  // Environmental-health work sits on the environment/health boundary.
  environment: ["health"],
  // Health funders show up at human-services and environmental-health events.
  health: ["human_services", "environment"],
  // Homelessness work spans housing and human-services identically.
  housing: ["human_services"],
  // Human services is the hub: most direct-service causes route through it.
  human_services: ["housing", "health", "youth", "faith_based"],
  // Arts education is the arts sector's biggest overlap with another cause.
  arts: ["education"],
};

/**
 * The set of cause areas adjacent to (but not including) the profile's own.
 * "other" carries no adjacency - it is an absence of a cause, not a cause.
 */
export function adjacentCauses(causeAreas: string[]): Set<string> {
  const own = new Set(causeAreas);
  const adjacent = new Set<string>();
  for (const cause of causeAreas) {
    for (const neighbor of CAUSE_ADJACENCY[cause] ?? []) {
      if (!own.has(neighbor)) adjacent.add(neighbor);
    }
  }
  return adjacent;
}
