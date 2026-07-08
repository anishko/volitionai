// Acceptance check for the Phase 2 matching pipeline — no UI required.
// Runs the full runEventMatch pipeline for TEST_PROFILE and prints the matches
// plus the cost receipt exactly as the API would return them.
//
//   npm run test:match          (or: npx tsx scripts/test-match.ts)
//
// Loads .env.local so Tavily/Anthropic keys are present. Degrades honestly when
// a source is unconfigured (Firecrawl/Supabase/Meetup/Luma) — the receipt and
// the "degraded" notices show exactly what ran and what didn't.
import path from "node:path";

try {
  // Node 22+ / tsx: pull keys from .env.local (standalone scripts don't inherit Next's env).
  // Done before any pipeline call; provider keys are read at call time, not import time.
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  console.warn("(no .env.local found — relying on ambient env; Tavily/Anthropic stages may be unavailable)");
}

import { runEventMatch } from "@/lib/signals/match";
import { TEST_PROFILE } from "@/lib/signals/schema";

const usd = (n: number) => `$${n.toFixed(4)}`;
const rule = (c = "─") => c.repeat(72);

function printProfile() {
  const p = TEST_PROFILE;
  console.log(rule("═"));
  console.log(`PROFILE: ${p.orgName}`);
  console.log(`  cause sub-tags : ${p.causeSubTags.join(", ")}`);
  console.log(`  geography      : ${p.geographyFocus} — ${p.geographyDetail ?? ""}`);
  console.log(`  budget         : $${p.annualBudgetCap?.toLocaleString()} cap for ${p.budgetPeriod} (budget-sensitive)`);
  console.log(`  wants          : more ${p.targetDonorType.join(", ")} donors; ${p.primaryGoal}`);
  console.log(rule("═"));
}

async function main() {
  const started = Date.now();
  printProfile();
  console.log("Running match pipeline (live: Tavily + Ollama + Anthropic; degraded: Firecrawl/ProPublica per config)...\n");

  const result = await runEventMatch(TEST_PROFILE, { persist: false });
  const { matches, events, receipt, meta } = result;
  const eventById = new Map(events.map((e) => [e.id, e]));

  console.log(rule());
  console.log(`MATCHES (${matches.length})`);
  console.log(rule());
  if (matches.length === 0) {
    console.log("  (no matches survived — see notices below; an honest empty result is acceptable)\n");
  }
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
    if (e?.certificatesOffered.length) {
      console.log(`   certificates: ${e.certificatesOffered.map((c) => c.type).join(", ")}`);
    }
  });

  console.log(`\n${rule()}`);
  console.log("COST RECEIPT");
  console.log(rule());
  console.log(`  run id            : ${receipt.runId}`);
  console.log(`  TOTAL             : ${usd(receipt.totalUsd)}`);
  console.log(`  local token share : ${receipt.localTokenShare}%  (tokens processed at $0 on Ollama)`);
  console.log(`  by stage:`);
  for (const s of receipt.byStage) {
    console.log(`    - ${s.stage.padEnd(14)} ${s.provider.padEnd(11)} ${usd(s.usd)}`);
  }

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
  console.log(`  cloud model          : ${meta.cloudModel ?? "(none — no cloud stage ran)"}`);
  if (meta.budgetStops.length) {
    console.log(`  budget stops:`);
    meta.budgetStops.forEach((b) => console.log(`      ⚠ ${b}`));
  }
  if (meta.degraded.length) {
    console.log(`  degraded sources:`);
    meta.degraded.forEach((d) => console.log(`      ○ ${d}`));
  }
  if (meta.notices.length) {
    console.log(`  notices:`);
    meta.notices.forEach((n) => console.log(`      • ${n}`));
  }

  console.log(`\n${rule("═")}`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("\n[test-match] pipeline error:", err);
  process.exit(1);
});
