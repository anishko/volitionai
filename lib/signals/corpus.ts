// The seed events corpus — the moat table's static backbone (PRD "Seed
// database"). In production the matcher reads the `events` table; for the
// Phase 2 pipeline + acceptance test (no DB required) it loads the curated
// CSV at supabase/seed/events.csv. Seed rows still require a source URL — the
// citation rule has no exceptions — so every row carries one and it becomes a
// permitted citation for that event's claims.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toCorpusEvent, type CorpusEvent } from "./schema";
import type { CertificateOffered, EventFormat, EventWithRoi } from "@/types";

const SEED_PATH = path.join(process.cwd(), "supabase", "seed", "events.csv");

const COLUMNS = [
  "name",
  "website",
  "start_date",
  "end_date",
  "location_city",
  "location_state",
  "location_country",
  "format",
  "cause_area_tags",
  "cause_sub_tags",
  "certificates",
  "description",
  "source_url",
] as const;
type Column = (typeof COLUMNS)[number];

/** Minimal RFC-4180 CSV parser: handles quoted fields, doubled quotes, and
 *  commas/newlines inside quotes. Kept dependency-free (the repo has no CSV lib). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully-blank lines.
      if (row.length > 1 || row[0].trim() !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
  }
  return rows;
}

const splitList = (v: string): string[] =>
  v
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

const clean = (v: string | undefined): string | undefined => {
  const t = (v ?? "").trim();
  return t.length ? t : undefined;
};

const VALID_FORMATS: EventFormat[] = ["in_person", "virtual", "hybrid"];

function rowToCorpusEvent(rec: Record<Column, string>): CorpusEvent | null {
  const name = clean(rec.name);
  const website = clean(rec.website);
  const sourceUrl = clean(rec.source_url);
  // Citation or no card: a seed row without a name, website, or source is dropped.
  if (!name || !website || !sourceUrl) return null;

  const now = new Date().toISOString();
  const format = clean(rec.format) as EventFormat | undefined;
  const certificates: CertificateOffered[] = splitList(rec.certificates).map((type) => ({
    type,
    sourceUrl,
  }));

  const event: EventWithRoi = {
    id: `seed_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`,
    name,
    website,
    startDate: clean(rec.start_date),
    endDate: clean(rec.end_date),
    locationCity: clean(rec.location_city),
    locationState: clean(rec.location_state),
    locationCountry: clean(rec.location_country),
    format: format && VALID_FORMATS.includes(format) ? format : undefined,
    causeAreaTags: splitList(rec.cause_area_tags),
    causeSubTags: splitList(rec.cause_sub_tags),
    isSeed: true,
    speakers: [],
    sponsors: [],
    organizerContacts: [],
    participationTiers: [],
    donorSignals: [],
    timingSignals: [],
    certificatesOffered: certificates,
    scrapeCount: 0,
    lastScrapedAt: undefined,
    createdAt: now,
  };

  // source_url is a permitted citation even when it differs from website.
  return toCorpusEvent(event, clean(rec.description), [sourceUrl]);
}

export interface SeedCorpusResult {
  events: CorpusEvent[];
  degraded: string[];
}

/** Load and normalize the seed CSV. Missing/garbled file degrades to an empty
 *  corpus with a notice rather than throwing — the run continues on live search. */
export async function loadSeedCorpus(csvPath: string = SEED_PATH): Promise<SeedCorpusResult> {
  const degraded: string[] = [];
  let raw: string;
  try {
    raw = await readFile(csvPath, "utf8");
  } catch {
    degraded.push(`Seed corpus not found at ${csvPath} — matching runs on live search only`);
    return { events: [], degraded };
  }

  const rows = parseCsv(raw);
  if (rows.length < 2) {
    degraded.push("Seed corpus is empty");
    return { events: [], degraded };
  }

  const header = rows[0].map((h) => h.trim());
  const events: CorpusEvent[] = [];
  let dropped = 0;
  for (const row of rows.slice(1)) {
    const rec = {} as Record<Column, string>;
    for (const col of COLUMNS) {
      const idx = header.indexOf(col);
      rec[col] = idx >= 0 ? (row[idx] ?? "") : "";
    }
    const ev = rowToCorpusEvent(rec);
    if (ev) events.push(ev);
    else dropped += 1;
  }
  if (dropped > 0) degraded.push(`${dropped} seed row(s) dropped for missing name/website/source_url`);

  return { events, degraded };
}
