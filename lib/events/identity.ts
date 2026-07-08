// Event identity (ADR-0006, PR5). Platform listings resolve to the organizer's
// domain when available; otherwise a fuzzy name+year+city key prevents the
// same real conference from fragmenting across seed, Eventbrite, and Tavily.
export interface IdentityInput {
  name: string;
  website: string;
  organizerUrl?: string;
  startDate?: string;
  locationCity?: string;
}

const PLATFORM_HOSTS = new Set([
  "eventbrite.com",
  "meetup.com",
  "lu.ma",
  "luma.com",
  "facebook.com",
  "linkedin.com",
  "10times.com",
  "allevents.in",
]);

export function normalizedHost(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function yearFromDate(iso?: string): string {
  if (!iso) return "unknown";
  const match = /^(\d{4})/.exec(iso);
  return match ? match[1] : "unknown";
}

function organizerDomain(input: IdentityInput): string | null {
  const fromOrganizer = input.organizerUrl ? normalizedHost(input.organizerUrl) : null;
  if (fromOrganizer && !PLATFORM_HOSTS.has(fromOrganizer)) return fromOrganizer;
  const fromWebsite = normalizedHost(input.website);
  if (fromWebsite && !PLATFORM_HOSTS.has(fromWebsite)) return fromWebsite;
  return null;
}

export function identityKeyFor(input: IdentityInput): string {
  const domain = organizerDomain(input);
  const year = yearFromDate(input.startDate);
  if (domain) return `org:${domain}:${year}`;
  return `fuzzy:${slugify(input.name)}:${year}:${slugify(input.locationCity ?? "unknown")}`;
}
