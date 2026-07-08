import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EnrichmentSuggestionsSchema,
  buildEnrichmentEnvelope,
  deriveEnrichmentUrls,
} from "./enrich";
import { CostMeter } from "@/lib/ai/cost";
import { enrichFromWebsite } from "./enrich";

vi.mock("@/lib/data/tavily", () => ({
  tavilyExtract: vi.fn(),
}));
vi.mock("@/lib/ai/ollama", () => ({
  OLLAMA_MODEL: "qwen3:8b",
  ollamaChat: vi.fn(),
}));
import { tavilyExtract } from "@/lib/data/tavily";
import { ollamaChat } from "@/lib/ai/ollama";

describe("deriveEnrichmentUrls", () => {
  it("returns homepage + /about, capped at 2", () => {
    expect(deriveEnrichmentUrls("https://acme.org")).toEqual([
      "https://acme.org/",
      "https://acme.org/about",
    ]);
  });
  it("dedups when the site IS /about and never exceeds 2", () => {
    const urls = deriveEnrichmentUrls("https://acme.org/about");
    expect(urls).toContain("https://acme.org/about");
    expect(urls.length).toBeLessThanOrEqual(2);
  });
  it("returns [] for a non-http/invalid URL", () => {
    expect(deriveEnrichmentUrls("not-a-url")).toEqual([]);
  });
});

describe("EnrichmentSuggestionsSchema", () => {
  it("fills defaults on a thin site", () => {
    const parsed = EnrichmentSuggestionsSchema.parse({ missionLanguage: "We help." });
    expect(parsed).toEqual({
      missionLanguage: "We help.",
      programAreas: [],
      namedSponsors: [],
      voiceTraits: [],
    });
  });
});

describe("buildEnrichmentEnvelope (fail-closed)", () => {
  const at = "2026-07-08T00:00:00.000Z";
  it("carries fields only when ready", () => {
    const env = buildEnrichmentEnvelope(
      {
        status: "ready",
        fields: { missionLanguage: "m", programAreas: [], namedSponsors: [], voiceTraits: [] },
        sourceUrls: ["https://acme.org/"],
      },
      at,
    );
    expect(env).toEqual({
      status: "ready",
      sourceUrls: ["https://acme.org/"],
      fields: { missionLanguage: "m", programAreas: [], namedSponsors: [], voiceTraits: [] },
      generatedAt: at,
    });
  });
  it("failed carries NO fields and empty sourceUrls", () => {
    const env = buildEnrichmentEnvelope({ status: "failed" }, at);
    expect(env).toEqual({ status: "failed", sourceUrls: [], generatedAt: at });
    expect(env.fields).toBeUndefined();
  });
  it("skipped carries NO fields and empty sourceUrls", () => {
    const env = buildEnrichmentEnvelope({ status: "skipped" }, at);
    expect(env).toEqual({ status: "skipped", sourceUrls: [], generatedAt: at });
    expect(env.fields).toBeUndefined();
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

import { runEnrichment } from "./enrich";
import type { NonprofitProfile } from "@/types";

function fakeAdmin(updateImpl: (payload: unknown) => Promise<{ error: unknown }>) {
  const eq = vi.fn(async (_col: string, _val: string) => ({ error: null }));
  const update = vi.fn((payload: unknown) => ({
    eq: async (_c: string, _v: string) => updateImpl(payload),
  }));
  return { from: vi.fn(() => ({ update })), _update: update } as any;
}

function baseProfile(): NonprofitProfile {
  return {
    id: "p1",
    userId: "u1",
    orgName: "Acme",
    website: "https://acme.org",
    causeAreas: [],
    currentDonorMix: [],
    targetDonorType: [],
    citiesOfInterest: [],
    regionsOfInterest: [],
    extractedProfile: {
      missionSummary: "CONFIRMED",
      causeKeywords: ["water"],
      donorProfile: "d",
      geographySummary: "g",
      eventSearchHints: ["h"],
    },
    createdAt: "t",
    updatedAt: "t",
  } as NonprofitProfile;
}

describe("runEnrichment (fail-closed persistence)", () => {
  it("preserves confirmed fields and nests the envelope", async () => {
    vi.stubEnv("TAVILY_API_KEY", "k");
    vi.mocked(tavilyExtract).mockResolvedValue({
      perUrl: [{ url: "https://acme.org/", content: "We fund water." }],
      failed: [],
      latencyMs: 1,
    });
    vi.mocked(ollamaChat).mockResolvedValue({
      text: JSON.stringify({ missionLanguage: "We fund water.", programAreas: [], namedSponsors: [], voiceTraits: [] }),
      model: "qwen3:8b", inputTokens: 1, outputTokens: 1, latencyMs: 1,
    });
    let captured: any;
    const admin = fakeAdmin(async (payload) => { captured = payload; return { error: null }; });
    await runEnrichment(admin, baseProfile(), "2026-07-08T00:00:00.000Z");
    expect(captured.extracted_profile.missionSummary).toBe("CONFIRMED");
    expect(captured.extracted_profile.causeKeywords).toEqual(["water"]);
    expect(captured.extracted_profile.suggestedEnrichments.status).toBe("ready");
  });

  it("writes a fail-closed 'failed' envelope when extraction throws", async () => {
    vi.stubEnv("TAVILY_API_KEY", "k");
    vi.mocked(tavilyExtract).mockRejectedValue(new Error("boom"));
    let captured: any;
    const admin = fakeAdmin(async (payload) => { captured = payload; return { error: null }; });
    await runEnrichment(admin, baseProfile(), "2026-07-08T00:00:00.000Z");
    expect(captured.extracted_profile.suggestedEnrichments).toEqual({
      status: "failed",
      sourceUrls: [],
      generatedAt: "2026-07-08T00:00:00.000Z",
    });
    expect(captured.extracted_profile.suggestedEnrichments.fields).toBeUndefined();
    expect(captured.extracted_profile.missionSummary).toBe("CONFIRMED");
  });

  it("never throws even when the DB write itself errors", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const admin = fakeAdmin(async () => { throw new Error("db down"); });
    await expect(runEnrichment(admin, baseProfile(), "t")).resolves.toBeUndefined();
  });
});

describe("enrichFromWebsite", () => {
  it("skips when TAVILY_API_KEY is unset", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const out = await enrichFromWebsite(new CostMeter("r"), "https://acme.org");
    expect(out).toEqual({ status: "skipped" });
    expect(tavilyExtract).not.toHaveBeenCalled();
  });

  it("skips when no page content comes back", async () => {
    vi.stubEnv("TAVILY_API_KEY", "k");
    vi.mocked(tavilyExtract).mockResolvedValue({ perUrl: [], failed: [], latencyMs: 5 });
    const out = await enrichFromWebsite(new CostMeter("r"), "https://acme.org");
    expect(out).toEqual({ status: "skipped" });
  });

  it("returns ready with parsed fields + sourceUrls from local extraction", async () => {
    vi.stubEnv("TAVILY_API_KEY", "k");
    vi.mocked(tavilyExtract).mockResolvedValue({
      perUrl: [{ url: "https://acme.org/", content: "We fund clean water. Sponsor: Acme Co." }],
      failed: ["https://acme.org/about"],
      latencyMs: 5,
    });
    vi.mocked(ollamaChat).mockResolvedValue({
      text: JSON.stringify({
        missionLanguage: "We fund clean water.",
        programAreas: ["clean water"],
        namedSponsors: ["Acme Co."],
        voiceTraits: ["earnest"],
      }),
      model: "qwen3:8b",
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    });
    const meter = new CostMeter("r");
    const out = await enrichFromWebsite(meter, "https://acme.org");
    expect(out).toEqual({
      status: "ready",
      fields: {
        missionLanguage: "We fund clean water.",
        programAreas: ["clean water"],
        namedSponsors: ["Acme Co."],
        voiceTraits: ["earnest"],
      },
      sourceUrls: ["https://acme.org/"],
    });
    // metered: 1 tavily credit (ceil(2/5)) + 1 ollama call
    expect(meter.events.some((e) => e.provider === "tavily")).toBe(true);
    expect(meter.events.some((e) => e.provider === "ollama")).toBe(true);
  });
});
