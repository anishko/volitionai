import { afterEach, describe, expect, it, vi } from "vitest";
import { tavilyExtract } from "./tavily";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("tavilyExtract", () => {
  it("maps successful and failed results", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [{ url: "https://ex.org", raw_content: "Hello world" }],
            failed_results: [{ url: "https://ex.org/about" }],
          }),
          { status: 200 },
        ),
      ),
    );
    const out = await tavilyExtract(["https://ex.org", "https://ex.org/about"]);
    expect(out.perUrl).toEqual([{ url: "https://ex.org", content: "Hello world" }]);
    expect(out.failed).toEqual(["https://ex.org/about"]);
  });

  it("throws when the API key is missing", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    await expect(tavilyExtract(["https://ex.org"])).rejects.toThrow(/TAVILY_API_KEY/);
  });
});
