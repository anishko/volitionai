// Demo insurance. Real prior pipeline output — captured on a successful live
// run — persisted to disk so the demo can survive a network failure on stage.
// This is NOT a mock: it is genuine output, timestamped, and labeled in-UI.
// See MOCKED.md. Server-only (uses fs).
import { promises as fs } from "fs";
import path from "path";
import type { IdeasRunResult } from "./pipeline/run";

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
  try {
    const file = path.join(FIXTURE_DIR, `${slug}.json`);
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as IdeasRunResult;
  } catch {
    return null;
  }
}

export async function listFixtures(): Promise<string[]> {
  try {
    const files = await fs.readdir(FIXTURE_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
