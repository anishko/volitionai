import { describe, expect, it } from "vitest";
import { guessFromSnippet } from "./snippet-guess";

describe("guessFromSnippet", () => {
  it("tags housing from the snippet keyword", () => {
    const guess = guessFromSnippet(
      "National Housing Forum 2026",
      "A convening for housing advocates in Denver, CO with foundation program officers.",
      "national",
    );
    expect(guess.causeAreaTags).toContain("housing");
    expect(guess.locationState).toBe("CO");
    expect(guess.format).toBe("in_person");
  });

  it("detects virtual events from snippet keywords", () => {
    const guess = guessFromSnippet(
      "Virtual youth mentoring summit",
      "Join online via Zoom for nonprofit leaders.",
      "national",
    );
    expect(guess.format).toBe("virtual");
    expect(guess.causeAreaTags).toContain("youth");
  });

  it("does not tag unrelated events with profile causes", () => {
    const guess = guessFromSnippet(
      "React Developer Conference 2026",
      "The best JavaScript conference for frontend engineers.",
      "national",
    );
    expect(guess.causeAreaTags).toHaveLength(0);
  });
});
