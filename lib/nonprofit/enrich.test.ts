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
