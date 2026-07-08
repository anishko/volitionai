// Provisional cause/geo classification for crawler candidates (ADR-0003, PR6).
// Keyword heuristic first — cheap and deterministic before any local-model call.
import { CAUSE_AREAS } from "@/lib/nonprofit/onboarding-schema";
import type { GeographyFocus } from "@/types";

const CAUSE_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  CAUSE_AREAS.filter((c) => c.value !== "other").map((c) => [
    c.value,
    [c.value.replaceAll("_", " "), c.label.toLowerCase()],
  ]),
);

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

export interface SnippetGuess {
  causeAreaTags: string[];
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: "in_person" | "virtual" | "hybrid";
}

export function guessFromSnippet(
  title: string,
  snippet: string,
  profileCauses: string[],
  geographyFocus?: GeographyFocus,
): SnippetGuess {
  const text = `${title} ${snippet}`.toLowerCase();
  const causeAreaTags = new Set<string>();
  for (const cause of profileCauses.filter((c) => c !== "other")) {
    causeAreaTags.add(cause);
  }
  for (const [cause, keywords] of Object.entries(CAUSE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) causeAreaTags.add(cause);
  }

  let locationState: string | undefined;
  let locationCity: string | undefined;

  const commaState = /,\s*([a-z]{2})\b/i.exec(text);
  if (commaState && Object.values(US_STATES).includes(commaState[1].toUpperCase())) {
    locationState = commaState[1].toUpperCase();
  }
  if (!locationState) {
    for (const [name, code] of Object.entries(US_STATES)) {
      if (text.includes(name)) {
        locationState = code;
        break;
      }
    }
  }
  const cityMatch = /\b(?:in|at)\s+([a-z][a-z\s]{2,30}?)(?:,|\s+[a-z]{2}\b|\s+20\d{2})/i.exec(text);
  if (cityMatch) locationCity = cityMatch[1].trim();

  let format: SnippetGuess["format"];
  if (/\b(virtual|online|webinar|zoom)\b/.test(text)) format = "virtual";
  else if (/\b(hybrid)\b/.test(text)) format = "hybrid";
  else if (/\b(in[- ]person|conference|convening|summit|forum|venue)\b/.test(text)) format = "in_person";

  return {
    causeAreaTags: [...causeAreaTags],
    locationCity,
    locationState,
    locationCountry: locationState || geographyFocus === "international" ? "USA" : undefined,
    format,
  };
}
