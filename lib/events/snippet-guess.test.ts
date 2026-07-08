import { describe, expect, it } from "vitest";
import { guessFromSnippet } from "./snippet-guess";

describe("guessFromSnippet", () => {
  it("tags housing from the snippet and keeps the profile cause", () => {
    const guess = guessFromSnippet(
      "National Housing Forum 2026",
      "A convening for housing advocates in Denver, CO with foundation program officers.",
      ["housing"],
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
      ["youth"],
      "national",
    );
    expect(guess.format).toBe("virtual");
    expect(guess.causeAreaTags).toContain("youth");
  });
});
