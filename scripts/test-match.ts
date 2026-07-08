// Acceptance check for the Phase 2 matching pipeline — no UI required.
// Runs the full runEventMatch pipeline and prints matches + cost receipt.
// When Supabase is configured it runs in NON-DEGRADED persistence mode:
// creates a FK-valid TEST profile, persists events + event_matches to the live
// DB, then reads the rows back to CONFIRM they landed. Firecrawl scraping runs
// only when FIRECRAWL_API_KEY is set; otherwise that source degrades honestly.
//
//   npm run test:match          (or: npx tsx scripts/test-match.ts)
import path from "node:path";

try {
  // Node 22+ / tsx: pull keys from .env.local (standalone scripts don't inherit Next's env).
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  console.warn("(no .env.local found — relying on ambient env)");
}

import { runEventMatch } from "@/lib/signals/match";
import { LIBERTY_LEGAL_AID_PROFILE } from "@/lib/signals/schema";
import { ensureTestProfileRow } from "@/lib/signals/profile-adapter";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { firecrawlConfigured } from "@/lib/signals/firecrawl-events";
import type { NonprofitProfileForMatch } from "@/types";

const TEST_EMAIL = "test-pipeline@volition.local";
const usd = (n: number) => `$${n.toFixed(4)}`;
const rule = (c = "─") => c.repeat(72);

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function printProfile(p: NonprofitProfileForMatch) {
  console.log(rule("═"));
  console.log(`PROFILE: ${p.orgName}`);
  console.log(`  profile id     : ${p.id}`);
  console.log(`  cause sub-tags : ${p.causeSubTags.join(", ")}`);
  console.log(`  geography      : ${p.geographyFocus} — ${p.geographyDetail ?? ""}`);
  console.log(`  budget         : $${p.annualBudgetCap?.toLocaleString()} cap for ${p.budgetPeriod} (budget-sensitive)`);
  console.log(`  wants          : more ${p.targetDonorType.join(", ")} donors; ${p.primaryGoal}`);
  console.log(rule("═"));
}

async function main() {
  const started = Date.now();

  const dbMode = supabaseConfigured();
  const fcMode = firecrawlConfigured();
  console.log(`MODE: Supabase persistence = ${dbMode ? "ON" : "off"} · Firecrawl scraping = ${fcMode ? "ON" : "off"}`);

  // In DB mode, create a FK-valid TEST profile and use its real uuid.
  let profile: NonprofitProfileForMatch = LIBERTY_LEGAL_AID_PROFILE;
  if (dbMode) {
    const admin = createSupabaseAdminClient();
    const { profileId, userId } = await ensureTestProfileRow(admin, TEST_EMAIL, LIBERTY_LEGAL_AID_PROFILE);
    console.log(`Ensured TEST profile: profile_id=${profileId} (auth user ${userId}, ${TEST_EMAIL})\n`);
    profile = { ...LIBERTY_LEGAL_AID_PROFILE, id: profileId, userId };
  }

  printProfile(profile);
  console.log("Running match pipeline (live: Tavily + Ollama + Anthropic)...\n");

  const result = await runEventMatch(profile, { persist: dbMode });
  const { matches, events, receipt, meta } = result;
  const eventById = new Map(events.map((e) => [e.id, e]));

  console.log(rule());
  console.log(`MATCHES (${matches.length})`);
  console.log(rule());
  if (matches.length === 0) console.log("  (no matches survived — an honest empty result is acceptable)\n");
  matches.forEach((m, i) => {
    const e = eventById.get(m.eventId);
    console.log(`\n${i + 1}. [${m.matchScore}] ${e?.name ?? m.eventId}`);
    console.log(`   ${e?.website ?? ""}`);
    const loc = [e?.locationCity, e?.locationState, e?.locationCountry].filter(Boolean).join(", ");
    if (loc || e?.format) console.log(`   ${[loc, e?.format].filter(Boolean).join(" · ")}`);
    console.log(`   why: ${m.whyAttend}`);
    if (m.donorSignalCallout) console.log(`   donor signal: ${m.donorSignalCallout}`);
    console.log(`   evidence (${m.evidence.length}):`);
    m.evidence.forEach((ev) => console.log(`     • ${ev.claim}\n       ↳ ${ev.sourceUrl}`));
    if (e?.certificatesOffered.length) console.log(`   certificates: ${e.certificatesOffered.map((c) => c.type).join(", ")}`);
  });

  console.log(`\n${rule()}`);
  console.log("COST RECEIPT");
  console.log(rule());
  console.log(`  run id            : ${receipt.runId}`);
  console.log(`  TOTAL             : ${usd(receipt.totalUsd)}`);
  console.log(`  local token share : ${receipt.localTokenShare}%  (tokens processed at $0 on Ollama)`);
  console.log(`  by stage:`);
  for (const s of receipt.byStage) console.log(`    - ${s.stage.padEnd(14)} ${s.provider.padEnd(11)} ${usd(s.usd)}`);

  console.log(`\n${rule()}`);
  console.log("RUN META");
  console.log(rule());
  console.log(`  queries planned      : ${meta.queries.length}`);
  meta.queries.forEach((q) => console.log(`      · ${q}`));
  console.log(`  candidates considered: ${meta.candidatesConsidered}`);
  console.log(`  finalists ranked     : ${meta.finalists}`);
  console.log(`  matches returned     : ${meta.matchesReturned}`);
  console.log(`  duplicates merged    : ${meta.duplicatesMerged}`);
  console.log(`  dropped (no citation): ${meta.droppedForNoCitation}`);
  console.log(`  cloud model          : ${meta.cloudModel ?? "(none)"}`);
  if (meta.persisted) console.log(`  PERSISTED            : ${meta.persisted.events} events, ${meta.persisted.matches} matches → live DB`);
  if (meta.budgetStops.length) { console.log(`  budget stops:`); meta.budgetStops.forEach((b) => console.log(`      ⚠ ${b}`)); }
  if (meta.degraded.length) { console.log(`  degraded sources:`); meta.degraded.forEach((d) => console.log(`      ○ ${d}`)); }
  if (meta.notices.length) { console.log(`  notices:`); meta.notices.forEach((n) => console.log(`      • ${n}`)); }

  // DB READ-BACK: prove the rows actually landed by querying them fresh.
  if (dbMode) {
    console.log(`\n${rule()}`);
    console.log("DATABASE READ-BACK (confirming rows landed)");
    console.log(rule());
    const admin = createSupabaseAdminClient();
    const { count: eventsTotal } = await admin.from("events").select("id", { count: "exact", head: true });
    const { data: matchRows, count: matchCount } = await admin
      .from("event_matches")
      .select("id, match_score, status, created_at, event:events(name, website)", { count: "exact" })
      .eq("profile_id", profile.id)
      .order("match_score", { ascending: false })
      .limit(6);
    console.log(`  public.events rows total                : ${eventsTotal}`);
    console.log(`  public.event_matches for this profile   : ${matchCount}`);
    console.log(`  sample persisted matches (score-desc):`);
    for (const r of matchRows ?? []) {
      const ev = (r as { event?: { name?: string; website?: string } }).event;
      console.log(`    - [${r.match_score}] ${ev?.name ?? "?"}  (match ${String(r.id).slice(0, 8)}… · ${r.status} · ${String(r.created_at).slice(0, 19)})`);
      console.log(`        ${ev?.website ?? ""}`);
    }
  }

  console.log(`\n${rule("═")}`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("\n[test-match] pipeline error:", err);
  process.exit(1);
});
