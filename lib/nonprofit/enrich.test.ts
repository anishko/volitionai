import { describe, expect, it } from "vitest";
import {
  EnrichmentSuggestionsSchema,
  buildEnrichmentEnvelope,
  deriveEnrichmentUrls,
} from "./enrich";

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
