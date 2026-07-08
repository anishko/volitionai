// STAGE: 990 enrichment (ProPublica Nonprofit Explorer — free, no key).
// Cross-references an event's SPONSORS/SPEAKER-ORGS against ProPublica's 990
// corpus: when a sponsor named like a grantmaker resolves to a real filing org,
// we emit a DonorSignal linking BOTH the 990 page and the event page the
// sponsor appeared on — citation on both ends, or no signal.
// Free source, but every call is still metered (usd:0) so the receipt accounts
// for it. Degrades cleanly if ProPublica is unreachable.
// (docs/NONPROFIT_EVENTS_PRD.md → "990 cross-reference".)
import { CostMeter } from "@/lib/ai/cost";
import type { DonorSignal, EventWithRoi } from "@/types";

const SEARCH_URL = "https://projects.propublica.org/nonprofits/api/v2/search.json";
const ORG_PAGE = (ein: string) => `https://projects.propublica.org/nonprofits/organizations/${ein}`;

// Only cross-reference sponsors whose name reads like a grantmaker — matching a
// random corporate booth against 990s would produce noise, not signal.
const GRANTMAKER_HINT = /\b(foundation|fund|trust|charitable|endowment|philanthrop|giving)\b/i;

// Keep the enrichment fast + polite to the free API.
const MAX_LOOKUPS_PER_RUN = 12;

interface ProPublicaOrg {
  ein: number | string;
  name: string;
  city?: string;
  state?: string;
  ntee_code?: string;
}

async function searchOrg(name: string, timeoutMs = 8000): Promise<ProPublicaOrg | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(name)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ProPublica ${res.status}`);
    const data = await res.json();
    const orgs: ProPublicaOrg[] = data?.organizations ?? [];
    if (orgs.length === 0) return null;
    // Prefer an exact-ish name match; else take the top hit.
    const lower = name.toLowerCase();
    return orgs.find((o) => (o.name ?? "").toLowerCase().includes(lower.split(" ")[0])) ?? orgs[0];
  } finally {
    clearTimeout(timer);
  }
}

export interface EnrichmentResult {
  events: EventWithRoi[];
  signalsAdded: number;
  degraded: string[];
}

/** Enrich each event's donorSignals in place-by-copy. Sponsors that look like
 *  grantmakers are resolved against ProPublica; matches become cited signals. */
export async function enrichDonorSignals(
  meter: CostMeter,
  events: EventWithRoi[],
): Promise<EnrichmentResult> {
  const degraded: string[] = [];
  let lookups = 0;
  let signalsAdded = 0;
  const resolved = new Map<string, ProPublicaOrg | null>(); // memoize by lower-cased name
  const started = Date.now();

  const out: EventWithRoi[] = [];
  for (const event of events) {
    // Candidate grantmaker names from sponsors (+ speaker orgs), each with the
    // event page url they were sourced from (the eventSourceUrl for the signal).
    const candidates: { name: string; eventSourceUrl: string }[] = [];
    for (const s of event.sponsors) {
      if (GRANTMAKER_HINT.test(s.name)) candidates.push({ name: s.name, eventSourceUrl: s.sourceUrl });
    }
    for (const sp of event.speakers) {
      if (sp.org && GRANTMAKER_HINT.test(sp.org)) {
        candidates.push({ name: sp.org, eventSourceUrl: sp.sourceUrl });
      }
    }

    const signals: DonorSignal[] = [...event.donorSignals];
    for (const c of candidates) {
      const key = c.name.toLowerCase();
      if (!resolved.has(key)) {
        if (lookups >= MAX_LOOKUPS_PER_RUN) break;
        lookups += 1;
        try {
          resolved.set(key, await searchOrg(c.name));
        } catch (err) {
          console.warn(
            `[propublica] lookup failed for "${c.name}":`,
            err instanceof Error ? err.message : err,
          );
          resolved.set(key, null);
        }
      }
      const org = resolved.get(key);
      if (!org) continue;
      const ein = String(org.ein);
      // Skip if we already have this foundation on this event.
      if (signals.some((sig) => sig.filingUrl === ORG_PAGE(ein))) continue;
      signals.push({
        foundationName: org.name,
        focusArea: org.ntee_code,        // NTEE code where present; omitted otherwise
        filingUrl: ORG_PAGE(ein),        // real public 990 page — citation #1
        eventSourceUrl: c.eventSourceUrl, // the event page tying them — citation #2
      });
      signalsAdded += 1;
    }

    out.push(signals.length === event.donorSignals.length ? event : { ...event, donorSignals: signals });
  }

  if (lookups > 0) {
    meter.free({ stage: "donor_signal", provider: "propublica", unitCount: lookups, latencyMs: Date.now() - started });
  }
  if (lookups >= MAX_LOOKUPS_PER_RUN) {
    degraded.push(`ProPublica lookups capped at ${MAX_LOOKUPS_PER_RUN}/run — some sponsors not cross-referenced`);
  }

  return { events: out, signalsAdded, degraded };
}
