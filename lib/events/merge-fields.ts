// Richest-field merge + multi-source URL preservation (ADR-0006, PR5). Pure
// functions the store layer calls before writing to Postgres.
import { normalizeUrl } from "./validate";
import type { EventFormat } from "@/types";

export interface CorpusSnapshot {
  id: string;
  identityKey: string;
  name: string;
  website: string;
  sourceUrls: string[];
  startDate?: string;
  endDate?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: EventFormat;
  causeAreaTags: string[];
  isSeed: boolean;
  scrapeCount: number;
  speakers: { name: string; title?: string; org?: string; sourceUrl: string }[];
  sponsors: { name: string; sourceUrl: string }[];
  organizerContacts: { name: string; role?: string; email?: string; sourceUrl: string }[];
  participationTiers: {
    tier: string;
    cost?: string;
    deadline?: string;
    applyUrl?: string;
    instructions?: string;
    sourceUrl: string;
    verifiedAt: string;
  }[];
  lastScrapedAt?: string;
}

export interface DiscoveredPayload {
  identityKey: string;
  name: string;
  website: string;
  sourceUrl: string;
  startDate?: string;
  endDate?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  format?: EventFormat;
  causeAreaTags: string[];
  speakers: CorpusSnapshot["speakers"];
  sponsors: CorpusSnapshot["sponsors"];
  organizerContacts: CorpusSnapshot["organizerContacts"];
  participationTiers: CorpusSnapshot["participationTiers"];
  scrapedAt?: string;
  isSeed: boolean;
}

function pickRicher<T>(existing: T | undefined, incoming: T | undefined): T | undefined {
  if (incoming !== undefined && incoming !== null && incoming !== "") return incoming;
  return existing;
}

function pickLonger<T>(existing: T[], incoming: T[]): T[] {
  return incoming.length > existing.length ? incoming : existing;
}

function pickNewerIso(existing?: string, incoming?: string): string | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return incoming > existing ? incoming : existing;
}

export function appendSourceUrl(existing: string[], incoming: string): string[] {
  const normalizedIncoming = normalizeUrl(incoming);
  if (!normalizedIncoming) return existing;
  const seen = new Set(existing.map((u) => normalizeUrl(u) ?? u));
  if (seen.has(normalizedIncoming)) return existing;
  return [...existing, incoming];
}

export function mergeDiscoveredPayload(
  existing: CorpusSnapshot,
  incoming: DiscoveredPayload,
): CorpusSnapshot {
  return {
    ...existing,
    name: existing.name.length >= incoming.name.length ? existing.name : incoming.name,
    website: existing.isSeed ? existing.website : pickRicher(existing.website, incoming.website) ?? existing.website,
    sourceUrls: appendSourceUrl(existing.sourceUrls, incoming.sourceUrl),
    startDate: pickRicher(existing.startDate, incoming.startDate),
    endDate: pickRicher(existing.endDate, incoming.endDate),
    locationCity: pickRicher(existing.locationCity, incoming.locationCity),
    locationState: pickRicher(existing.locationState, incoming.locationState),
    locationCountry: pickRicher(existing.locationCountry, incoming.locationCountry),
    format: pickRicher(existing.format, incoming.format),
    causeAreaTags: Array.from(new Set([...existing.causeAreaTags, ...incoming.causeAreaTags])),
    speakers: pickLonger(existing.speakers, incoming.speakers),
    sponsors: pickLonger(existing.sponsors, incoming.sponsors),
    organizerContacts: pickLonger(existing.organizerContacts, incoming.organizerContacts),
    participationTiers: pickLonger(existing.participationTiers, incoming.participationTiers),
    scrapeCount: existing.scrapeCount + 1,
    lastScrapedAt: pickNewerIso(existing.lastScrapedAt, incoming.scrapedAt),
    isSeed: existing.isSeed,
  };
}

export function snapshotFromInsert(payload: DiscoveredPayload): CorpusSnapshot {
  return {
    id: "",
    identityKey: payload.identityKey,
    name: payload.name,
    website: payload.website,
    sourceUrls: [payload.sourceUrl],
    startDate: payload.startDate,
    endDate: payload.endDate,
    locationCity: payload.locationCity,
    locationState: payload.locationState,
    locationCountry: payload.locationCountry,
    format: payload.format,
    causeAreaTags: payload.causeAreaTags,
    isSeed: payload.isSeed,
    scrapeCount: 1,
    speakers: payload.speakers,
    sponsors: payload.sponsors,
    organizerContacts: payload.organizerContacts,
    participationTiers: payload.participationTiers,
    lastScrapedAt: payload.scrapedAt,
  };
}
