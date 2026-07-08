// Acceptance tests for the source router (ADR-0002, PR4). Fetch is stubbed so
// dead-endpoint degradation and budget stops are verified without live API keys.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CostMeter } from "@/lib/ai/cost";
import type { NonprofitProfile } from "@/types";
import { eventbriteAdapter } from "./eventbrite";
import { meetupAdapter } from "./meetup";
import { tavilyAdapter } from "./tavily";
import { fetchSourceCandidates } from "./router";
import { EVENTBRITE_MAX_QUERIES_PER_RUN } from "./types";

function makeProfile(overrides: Partial<NonprofitProfile> = {}): NonprofitProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    orgName: "Test Org",
    causeAreas: ["housing"],
    currentDonorMix: [],
    targetDonorType: [],
    geographyFocus: "national",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("fetchSourceCandidates (router ordering)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs structured adapters before the crawler adapter", async () => {
    const order: string[] = [];
    vi.spyOn(eventbriteAdapter, "fetch").mockImplementation(async () => {
      order.push("eventbrite");
      return { candidates: [], notices: [] };
    });
    vi.spyOn(meetupAdapter, "fetch").mockImplementation(async () => {
      order.push("meetup");
      return { candidates: [], notices: [] };
    });
    vi.spyOn(tavilyAdapter, "fetch").mockImplementation(async () => {
      order.push("tavily");
      return { candidates: [], notices: [] };
    });

    const meter = new CostMeter("test-run");
    await fetchSourceCandidates(meter, makeProfile(), ["housing conference 2026"]);

    expect(order).toEqual(["eventbrite", "meetup", "tavily"]);
  });

  it("aggregates candidates from every adapter and dedupes by URL (structured wins)", async () => {
    const sharedUrl = "https://example.org/shared-event";
    vi.spyOn(eventbriteAdapter, "fetch").mockResolvedValue({
      candidates: [
        {
          kind: "structured",
          sourceId: "eventbrite",
          canonicalUrl: sharedUrl,
          name: "Structured name",
          causeAreaTags: ["housing"],
          query: "q1",
        },
      ],
      notices: [],
    });
    vi.spyOn(meetupAdapter, "fetch").mockResolvedValue({ candidates: [], notices: [] });
    vi.spyOn(tavilyAdapter, "fetch").mockResolvedValue({
      candidates: [
        {
          kind: "crawler",
          sourceId: "tavily",
          url: sharedUrl,
          title: "Crawler title",
          snippet: "snippet",
          query: "q1",
        },
        {
          kind: "crawler",
          sourceId: "tavily",
          url: "https://example.org/only-crawler",
          title: "Only crawler",
          snippet: "snippet",
          query: "q2",
        },
      ],
      notices: [],
    });

    const meter = new CostMeter("test-run");
    const outcome = await fetchSourceCandidates(meter, makeProfile(), ["q1", "q2"]);

    expect(outcome.candidates).toHaveLength(2);
    const shared = outcome.candidates.find((c) => candidateUrl(c) === sharedUrl);
    expect(shared?.kind).toBe("structured");
    expect(outcome.meta.structuredCount).toBe(1);
    expect(outcome.meta.crawlerCount).toBe(2);
    expect(outcome.meta.bySource).toEqual({ eventbrite: 1, tavily: 2 });
  });

  it("surfaces per-adapter budget stops without throwing", async () => {
    vi.spyOn(eventbriteAdapter, "fetch").mockResolvedValue({
      candidates: [],
      notices: [],
      stoppedAtBudget: true,
    });
    vi.spyOn(meetupAdapter, "fetch").mockResolvedValue({ candidates: [], notices: [] });
    vi.spyOn(tavilyAdapter, "fetch").mockResolvedValue({
      candidates: [],
      notices: ["Tavily search stopped at the 20-credit budget; some planned queries were not run."],
      stoppedAtBudget: true,
    });

    const meter = new CostMeter("test-run");
    const outcome = await fetchSourceCandidates(meter, makeProfile(), ["q"]);

    expect(outcome.budgetStops).toEqual([
      "eventbrite search stopped at its per-run query budget.",
      "tavily search stopped at its per-run query budget.",
    ]);
  });

  it("never throws when an adapter fetch rejects", async () => {
    vi.spyOn(eventbriteAdapter, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(meetupAdapter, "fetch").mockResolvedValue({ candidates: [], notices: [] });
    vi.spyOn(tavilyAdapter, "fetch").mockResolvedValue({ candidates: [], notices: [] });

    const meter = new CostMeter("test-run");
    const outcome = await fetchSourceCandidates(meter, makeProfile(), ["q"]);

    expect(outcome.candidates).toEqual([]);
    expect(outcome.notices).toContain("eventbrite source unavailable for this run.");
  });
});

describe("eventbriteAdapter", () => {
  const originalKey = process.env.EVENTBRITE_API_KEY;

  beforeEach(() => {
    process.env.EVENTBRITE_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "NOT_FOUND",
      }),
    );
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EVENTBRITE_API_KEY;
    else process.env.EVENTBRITE_API_KEY = originalKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("treats a 404 as source unavailable with a notice, not a thrown run", async () => {
    const meter = new CostMeter("test-run");
    const outcome = await eventbriteAdapter.fetch(makeProfile(), ["housing gala"], meter);

    expect(outcome.candidates).toEqual([]);
    expect(outcome.notices).toContain(
      "Eventbrite search unavailable (API endpoint retired or restricted).",
    );
    expect(meter.events.some((e) => e.provider === "eventbrite")).toBe(true);
  });

  it("stops at the per-run query budget", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events: [] }),
      }),
    );

    const queries = Array.from({ length: EVENTBRITE_MAX_QUERIES_PER_RUN + 3 }, (_, i) => `q${i}`);
    const meter = new CostMeter("test-run");
    const outcome = await eventbriteAdapter.fetch(makeProfile(), queries, meter);

    expect(outcome.stoppedAtBudget).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(EVENTBRITE_MAX_QUERIES_PER_RUN);
  });
});

describe("meetupAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops with a notice when unconfigured", async () => {
    const original = process.env.MEETUP_ACCESS_TOKEN;
    delete process.env.MEETUP_ACCESS_TOKEN;

    const meter = new CostMeter("test-run");
    const outcome = await meetupAdapter.fetch(makeProfile(), ["housing"], meter);

    if (original) process.env.MEETUP_ACCESS_TOKEN = original;
    expect(outcome.candidates).toEqual([]);
    expect(outcome.notices.some((n) => n.includes("Meetup not configured"))).toBe(true);
  });
});

function candidateUrl(c: { kind: string; canonicalUrl?: string; url?: string }): string {
  return (c.kind === "structured" ? c.canonicalUrl : c.url) ?? "";
}
