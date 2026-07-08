import { describe, expect, it } from "vitest";
import { feedBroadenedNotice, matchTierLabel } from "./match-tier-label";

describe("matchTierLabel", () => {
  it("returns null for strict matches", () => {
    expect(matchTierLabel("strict")).toBeNull();
  });

  it("labels cause_broadened matches distinctly from strict", () => {
    const label = matchTierLabel("cause_broadened");
    expect(label?.short).toBe("Related causes");
    expect(label?.tooltip).toMatch(/broadened/i);
  });

  it("surfaces the feed header only when results were relaxed", () => {
    expect(feedBroadenedNotice(false)).toBeNull();
    expect(feedBroadenedNotice(true)).toMatch(/broadened/i);
  });
});
