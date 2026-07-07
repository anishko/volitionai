// Demo insurance. Real prior pipeline output — captured on a successful live
// run — persisted to disk so the demo can survive a network failure on stage.
// This is NOT a mock: it is genuine output, timestamped, and labeled in-UI.
// See MOCKED.md. Server-only (uses fs).
import { promises as fs } from "fs";
import path from "path";
import type { IdeasRunResult } from "./pipeline/run";

// Static imports so fixtures are bundled INTO the serverless function.
// Reading them via fs from process.cwd() fails on Vercel (the files are not in
// the lambda filesystem) — importing the JSON makes the cached path work in prod.
import crestview from "@/fixtures/demo/crestview-trading-club.json";
import camino from "@/fixtures/demo/camino-coffee.json";
import liberty from "@/fixtures/demo/liberty-legal-aid.json";

const FIXTURES: Record<string, IdeasRunResult> = {
  "crestview-trading-club": crestview as unknown as IdeasRunResult,
  "camino-coffee": camino as unknown as IdeasRunResult,
  "liberty-legal-aid": liberty as unknown as IdeasRunResult,
};

// Local-only: where captureFixture writes new fixtures during dev (CAPTURE_FIXTURE=1).
const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "demo");

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Write-on-success capture. Gated by CAPTURE_FIXTURE=1 so normal runs are
 *  untouched. Stamps capturedAt so the UI can show "Cached run from <ts>". */
export async function captureFixture(
  slug: string,
  result: IdeasRunResult,
): Promise<string | null> {
  if (process.env.CAPTURE_FIXTURE !== "1") return null;
  const capturedAt = new Date().toISOString();
  const stamped: IdeasRunResult = {
    ...result,
    meta: { ...result.meta, capturedAt },
  };
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, `${slug}.json`);
  await fs.writeFile(file, JSON.stringify(stamped, null, 2), "utf8");
  return file;
}

export async function loadFixture(slug: string): Promise<IdeasRunResult | null> {
  // Bundled at build time — works identically on localhost and Vercel serverless.
  return FIXTURES[slug] ?? null;
}

export async function listFixtures(): Promise<string[]> {
  return Object.keys(FIXTURES);
}
