// STAGE: candidate filtering (RULES, code — runs BEFORE any LLM so cloud spend
// only touches finalists). Cause-area overlap + geography, with the v3 rules:
//  - filter on cause SUB-TAGS when the profile has them and the event is tagged,
//    else fall back to top-level cause areas;
//  - when the profile signals budget sensitivity, VIRTUAL events are first-class
//    candidates — never dropped for being remote (PRD "Candidate filtering").
// Live-discovered, still-untagged events are kept provisionally (the targeted
// query already topically filtered them); ranking + the explainer judge them.
import { isBudgetSensitive } from "./tavily-events";
import type { CorpusEvent, ScoredCandidate } from "./schema";
import type { MatchCandidateReason, NonprofitProfileForMatch } from "@/types";

const STOP = new Set(["and", "the", "for", "of", "/", "&", "reform", "rights", "policy"]);

/** Significant lowercased word tokens (>3 chars, minus a few generic ones). */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

/** Overlap between two tag lists: exact (normalized) match OR a shared
 *  significant word. Handles "civil liberties / government accountability"
 *  (profile) vs "civil liberties" (event tag). */
function tagsOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const bNorm = b.map((t) => t.toLowerCase().trim());
  const bTokens = b.map(tokens);
  for (const term of a) {
    const t = term.toLowerCase().trim();
    if (bNorm.some((x) => x === t || x.includes(t) || t.includes(x))) return true;
    const at = tokens(term);
    if (bTokens.some((set) => [...at].some((w) => set.has(w)))) return true;
  }
  return false;
}

function geographyMatch(p: NonprofitProfileForMatch, ce: CorpusEvent): boolean {
  const focus = p.geographyFocus ?? "national";
  // National / international orgs travel anywhere in-scope; geography is not a gate.
  if (focus === "national" || focus === "international") return true;

  const detail = (p.geographyDetail ?? "").toLowerCase();
  if (!detail) return true; // no stated region → don't gate on geography
  const loc = [ce.event.locationCity, ce.event.locationState, ce.event.locationCountry]
    .filter(Boolean)
    .join(", ")
    .toLowerCase();
  if (!loc) return false; // local/regional org + event with no known location → can't confirm
  return [...tokens(detail)].some((w) => loc.includes(w));
}

export interface FilterResult {
  kept: ScoredCandidate[];   // similarity is 0 here; the rank stage fills it in
  considered: number;
}

export function filterCandidates(
  profile: NonprofitProfileForMatch,
  candidates: CorpusEvent[],
): FilterResult {
  const budgetSensitive = isBudgetSensitive(profile);
  const useSubTags = profile.causeSubTags.length > 0;
  const kept: ScoredCandidate[] = [];

  for (const ce of candidates) {
    const e = ce.event;
    const reasons: MatchCandidateReason[] = [];
    const isVirtual = e.format === "virtual" || e.format === "hybrid";
    const virtualFirstClass = budgetSensitive && isVirtual;

    const hasTags = e.causeAreaTags.length > 0 || e.causeSubTags.length > 0;

    // 1. Cause relevance.
    let causeOk: boolean;
    if (!hasTags) {
      // Untagged live-discovery hit — can't prove overlap; keep provisionally.
      causeOk = !e.isSeed;
    } else if (useSubTags && e.causeSubTags.length > 0) {
      causeOk = tagsOverlap(profile.causeSubTags, e.causeSubTags);
      if (causeOk) reasons.push("sub_tag_overlap");
      // Fall back to top-level overlap if sub-tags miss.
      if (!causeOk && tagsOverlap(profile.causeAreas, e.causeAreaTags)) {
        causeOk = true;
        reasons.push("cause_area_overlap");
      }
    } else {
      causeOk = tagsOverlap(profile.causeAreas, e.causeAreaTags);
      if (causeOk) reasons.push("cause_area_overlap");
    }

    // 2. Geography (or virtual-first-class override).
    const geoOk = geographyMatch(profile, ce);
    if (geoOk) reasons.push("geography_match");
    if (virtualFirstClass) reasons.push("virtual_first_class");

    if (e.isSeed) reasons.push("seed_corpus");

    const keep = causeOk && (geoOk || virtualFirstClass);
    if (keep) kept.push({ ...ce, reasons, similarity: 0 });
  }

  return { kept, considered: candidates.length };
}
