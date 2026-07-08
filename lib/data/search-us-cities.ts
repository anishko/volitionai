// Server-side US city search for the headquarters combobox fallback.
import cities from "./us-cities.json";

const US_CITIES = cities as string[];

export function searchUsCities(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matches: string[] = [];
  for (const city of US_CITIES) {
    if (city.toLowerCase().includes(q)) {
      matches.push(city);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

export function isKnownUsCity(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return US_CITIES.some((c) => c.toLowerCase() === normalized);
}

/** Headquarters must be empty or a picked U.S. city (static index or Google Places shape). */
export function isValidHeadquarters(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (isKnownUsCity(v)) return true;
  return /^[^,]+,\s[A-Z]{2}$/.test(v);
}
