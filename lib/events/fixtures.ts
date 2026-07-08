// Demo insurance for the events pipeline. Mirrors lib/fixtures.ts for the
// legacy ideas pipeline. Real prior pipeline output captured with
// CAPTURE_EVENT_FIXTURE=1 and served on DEMO_FALLBACK=1.
// See MOCKED.md for honesty accounting.
import { promises as fs } from "fs";
import path from "path";
import type { CostReceipt } from "@/types/cost";
import type { EventMatchRunMeta, EventMatchRunResult } from "./run";
import type { EventFeedItem } from "./feed-item";
import { sortEventFeedItems } from "./feed-item";

export interface EventMatchFixture {
  matches: EventFeedItem[];
  receipt: CostReceipt;
  meta: EventMatchRunMeta & { capturedAt?: string };
}

// Static imports are added here by the capture step (CAPTURE_EVENT_FIXTURE=1).
// Each import is bundled at build time so the fallback works on Vercel too
// (identical to the lib/fixtures.ts pattern).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIXTURES: Record<string, EventMatchFixture> = {} as Record<string, any>;

try {
  // Dynamic requires are resolved at build time by the bundler only when the
  // fixture files exist. Missing files are handled by the empty FIXTURES object.
  // Individual personas are added by the capture helper below; this block
  // intentionally starts empty.
} catch {
  // no-op — fixtures directory not yet populated
}

const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "events");

export function slugifyPersona(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Return the fixture for a persona slug, or null if not yet captured. */
export function loadEventFixture(slug: string): EventMatchFixture | null {
  return FIXTURES[slug] ?? null;
}

/** First available fixture — used by GET path when persona is unknown. */
export function defaultEventFixture(): EventMatchFixture | null {
  const first = Object.values(FIXTURES)[0];
  return first ?? null;
}

/**
 * Write-on-success capture (opt-in via CAPTURE_EVENT_FIXTURE=1).
 * After capturing, add a static import to FIXTURES above and re-deploy so
 * the fixture is bundled into the serverless function.
 */
export async function captureEventFixture(
  slug: string,
  result: EventMatchRunResult,
): Promise<string | null> {
  if (process.env.CAPTURE_EVENT_FIXTURE !== "1") return null;
  const capturedAt = new Date().toISOString();
  const fixture: EventMatchFixture = {
    matches: sortEventFeedItems(result.matches),
    receipt: result.receipt,
    meta: { ...result.meta, capturedAt },
  };
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, `${slug}.json`);
  await fs.writeFile(file, JSON.stringify(fixture, null, 2), "utf8");
  console.log(
    `[event-fixture] captured ${file}\n` +
    `  Next: add this import to lib/events/fixtures.ts:\n` +
    `  import ${slug.replace(/-/g, "_")} from "@/fixtures/events/${slug}.json";\n` +
    `  And register: FIXTURES["${slug}"] = ${slug.replace(/-/g, "_")} as unknown as EventMatchFixture;`,
  );
  return file;
}
