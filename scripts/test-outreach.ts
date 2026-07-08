// Acceptance check for Phase 5 outreach drafting — no UI, no HTTP.
// Reads the REAL persisted matches for the "TEST — Liberty Legal Aid" profile
// from the live DB (service role), then drafts all three outreach types against
// the top match and prints the drafts + the cost receipt.
//
//   npx tsx scripts/test-outreach.ts
//
// Note: this exercises the same core (draftOutreach + CostMeter) the API route
// uses. It does NOT persist to outreach_drafts (that migration is not pushed yet).
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  console.warn("(no .env.local found — need Supabase + Ollama to run)");
}

import { CostMeter, newRunId } from "@/lib/ai/cost";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rowToEventMatch, rowToEvent, type EventMatchRow, type EventRow } from "@/lib/events/event-row";
import { rowToNonprofitProfile, type NonprofitProfileRow } from "@/lib/nonprofit/profile-row";
import { draftOutreach } from "@/lib/outreach/draft";
import type { OutreachDraftType } from "@/types";

const rule = (c = "─") => c.repeat(72);
const TYPES: OutreachDraftType[] = ["sponsor_pitch", "cfp_abstract", "intro_email"];

async function main() {
  const started = Date.now();
  const admin = createSupabaseAdminClient();

  // 1. Find the TEST — Liberty Legal Aid profile (persisted by the pipeline run).
  const { data: profileRow } = await admin
    .from("nonprofit_profiles")
    .select("*")
    .ilike("org_name", "%Liberty Legal Aid%")
    .limit(1)
    .maybeSingle();
  if (!profileRow) {
    console.error("No 'TEST — Liberty Legal Aid' profile found. Run the pipeline acceptance first to persist it.");
    process.exit(1);
  }
  const profile = rowToNonprofitProfile(profileRow as NonprofitProfileRow);

  // 2. Its top persisted match + the event it points at.
  const { data: matchRows } = await admin
    .from("event_matches")
    .select("*")
    .eq("profile_id", profile.id)
    .order("match_score", { ascending: false })
    .limit(1);
  const matchRow = (matchRows ?? [])[0];
  if (!matchRow) {
    console.error(`No persisted event_matches for profile ${profile.id}. Run the matcher first.`);
    process.exit(1);
  }
  const match = rowToEventMatch(matchRow as EventMatchRow);
  const { data: eventRow } = await admin.from("events").select("*").eq("id", match.eventId).maybeSingle();
  const event = eventRow ? rowToEvent(eventRow as EventRow) : null;

  console.log(rule("═"));
  console.log(`PROFILE : ${profile.orgName}  (${profile.id})`);
  console.log(`MATCH   : [${match.matchScore}] ${event?.name ?? match.eventId}`);
  console.log(`          ${event?.website ?? ""}`);
  console.log(`          cited claims backing this match: ${match.evidence.length}`);
  console.log(`VOICE   : ${profile.voiceProfile ? "voice profile present" : "none (plain org voice)"}`);
  console.log(rule("═"));

  // 3. Draft all three types against the top match, one meter across all.
  const meter = new CostMeter(newRunId());
  for (const draftType of TYPES) {
    const r = await draftOutreach(meter, { profile, match, event, draftType });
    console.log(`\n${rule()}`);
    console.log(`DRAFT: ${draftType}   [route: ${r.modelRoute}]`);
    console.log(rule());
    console.log(r.body);
    console.log(`\n  evidence drawn on (${r.evidence.length}):`);
    r.evidence.forEach((e) => console.log(`    • ${e.claim}\n      ↳ ${e.sourceUrl}`));
  }

  // 4. Receipt.
  const receipt = meter.receipt();
  console.log(`\n${rule()}`);
  console.log("COST RECEIPT (all three drafts)");
  console.log(rule());
  console.log(`  run id            : ${receipt.runId}`);
  console.log(`  TOTAL             : $${receipt.totalUsd.toFixed(4)}`);
  console.log(`  local token share : ${receipt.localTokenShare}%`);
  for (const s of receipt.byStage) console.log(`    - ${s.stage.padEnd(8)} ${s.provider.padEnd(10)} $${s.usd.toFixed(4)}`);

  console.log(`\n${rule("═")}`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("\n[test-outreach] error:", err);
  process.exit(1);
});
