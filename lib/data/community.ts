// Shared shape for community-scale event discovery (Meetup API + Luma scrape).
// Deliberately minimal: a community listing yields a name, its own public URL
// (the source_url — citation or no signal), and whatever logistics are stated.
// Enrichment (speakers, sponsors, deadlines) is left to the normal Firecrawl
// scrape path if the event is later deep-scraped.
export type CommunitySource = "meetup" | "luma";

export interface CommunityEvent {
  source: CommunitySource;
  name: string;
  /** The event's own public page — becomes website/source_url in the corpus. */
  sourceUrl: string;
  startDate?: string; // ISO date; omitted when the listing doesn't state one
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: "in_person" | "virtual" | "hybrid";
}
