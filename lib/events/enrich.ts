// STAGE 4: donor presence enrichment. Cross-references foundation-looking
// names on event pages (sponsors, speaker orgs) against ProPublica's
// Nonprofit Explorer. A confirmed match becomes a DonorSignal citing both the
// public 990 filings page and the event page where the name appeared —
// citation or no signal, on both ends.
import { propublicaSearch } from "@/lib/data/propublica";
import { CostMeter } from "@/lib/ai/cost";
import type { DonorSignal, Event } from "@/types";

// Keep the free API polite and the run fast: cap lookups per match run.
export const MAX_PROPUBLICA_LOOKUPS_PER_RUN = 15;

const FOUNDATION_HINT = /foundation|charitable|philanthrop|\bfund\b|\btrust\b/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.length > 4 && nb.length > 4 && (na === nb || na.includes(nb) || nb.includes(na));
}

interface FoundationMention {
  name: string;
  eventSourceUrl: string;
}

/** Foundation-looking names on an event's page, with where they appeared. */
function foundationMentions(event: Event): FoundationMention[] {
  const mentions: FoundationMention[] = [];
  for (const s of event.sponsors) {
    if (FOUNDATION_HINT.test(s.name)) mentions.push({ name: s.name, eventSourceUrl: s.sourceUrl });
  }
  for (const s of event.speakers) {
    if (s.org && FOUNDATION_HINT.test(s.org)) mentions.push({ name: s.org, eventSourceUrl: s.sourceUrl });
  }
  return mentions;
}

export interface DonorEnrichmentOutcome {
  /** eventId → confirmed donor signals found this run. */
  signalsByEvent: Map<string, DonorSignal[]>;
  lookupsRun: number;
  lookupsFailed: number;
}

export async function enrichDonorSignals(
  meter: CostMeter,
  events: Event[],
): Promise<DonorEnrichmentOutcome> {
  const signalsByEvent = new Map<string, DonorSignal[]>();
  // One lookup per unique foundation name across the whole run.
  const cache = new Map<string, DonorSignal | null>();
  let lookupsRun = 0;
  let lookupsFailed = 0;
  const started = Date.now();

  for (const event of events) {
    for (const mention of foundationMentions(event)) {
      const key = normalizeName(mention.name);
      if (!cache.has(key)) {
        if (lookupsRun >= MAX_PROPUBLICA_LOOKUPS_PER_RUN) continue;
        lookupsRun += 1;
        try {
          const { orgs } = await propublicaSearch(mention.name);
          const match = orgs.find((o) => namesMatch(o.name, mention.name));
          cache.set(
            key,
            match
              ? {
                  foundationName: match.name,
                  focusArea: match.nteeCode,
                  filingUrl: match.filingUrl,
                  eventSourceUrl: mention.eventSourceUrl,
                }
              : null,
          );
        } catch (err) {
          lookupsFailed += 1;
          cache.set(key, null);
          console.warn(
            `[events/enrich] ProPublica lookup failed for "${mention.name}":`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      const cached = cache.get(key);
      if (!cached) continue;
      const signal: DonorSignal = { ...cached, eventSourceUrl: mention.eventSourceUrl };
      const existing = signalsByEvent.get(event.id) ?? [];
      if (!existing.some((s) => s.filingUrl === signal.filingUrl)) {
        signalsByEvent.set(event.id, [...existing, signal]);
      }
    }
  }

  meter.propublica({
    stage: "donor_signal",
    calls: lookupsRun,
    latencyMs: Date.now() - started,
  });

  return { signalsByEvent, lookupsRun, lookupsFailed };
}
