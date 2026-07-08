// ProPublica Nonprofit Explorer API (free REST, no key). Two uses:
// 1. Events pipeline: confirm a foundation named on an event page is a real
//    filing nonprofit — the DonorSignal.filingUrl citation.
// 2. Ideas pipeline: surface peer orgs as Evidence items for comparable/donor lanes.
import type { Evidence } from "./tavily";

export interface ProPublicaOrg {
  ein: number;
  name: string;
  city?: string;
  state?: string;
  nteeCode?: string;
  /** Public filings page — the DonorSignal.filingUrl citation. */
  filingUrl: string;
}

export interface ProPublicaSearchOutcome {
  orgs: ProPublicaOrg[];
  latencyMs: number;
}

const SEARCH_URL = "https://projects.propublica.org/nonprofits/api/v2/search.json";

export async function propublicaSearch(
  query: string,
  maxResults?: number,
  timeoutMs = 15_000,
): Promise<ProPublicaSearchOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`ProPublica ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    let orgs: ProPublicaOrg[] = (data?.organizations ?? [])
      .filter((o: unknown): o is { ein: number; name: string } => {
        const org = o as { ein?: unknown; name?: unknown };
        return typeof org.ein === "number" && typeof org.name === "string";
      })
      .map((o: Record<string, unknown>) => ({
        ein: Number(o.ein),
        name: String(o.name),
        city: typeof o.city === "string" ? o.city : undefined,
        state: typeof o.state === "string" ? o.state : undefined,
        nteeCode: typeof o.ntee_code === "string" ? o.ntee_code : undefined,
        filingUrl: `https://projects.propublica.org/nonprofits/organizations/${o.ein}`,
      }));
    if (maxResults != null) orgs = orgs.slice(0, maxResults);
    return { orgs, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Convert a ProPublica org into the shared Evidence format for ideas-pipeline synthesis. */
export function orgToEvidence(org: ProPublicaOrg, query: string): Evidence {
  const location = [org.city, org.state].filter(Boolean).join(", ");
  const parts: string[] = [];
  if (org.nteeCode) parts.push(`NTEE code: ${org.nteeCode}`);
  parts.push("IRS Form 990 data via ProPublica Nonprofit Explorer");
  return {
    url: org.filingUrl,
    title: `${org.name}${location ? ` (${location})` : ""}`,
    snippet: parts.join(". "),
    source: "propublica",
    query,
  };
}
