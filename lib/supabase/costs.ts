// Persists CostEvents to the query_costs ledger (service role; the table has
// no client policies). Cost metering is not optional — callers must invoke
// this on every metered run. A ledger write failure must not lose the user's
// result, so failures are logged loudly and surfaced to the caller as a flag
// rather than thrown.
import { createSupabaseAdminClient } from "./admin";
import type { CostEvent } from "@/types/cost";

export async function persistCostEvents(args: {
  events: CostEvent[];
  runType: "profile_extraction" | "event_match" | "event_scrape" | "outreach_draft" | "idea_generation";
  entityId?: string; // profile_id for profile/match runs
}): Promise<{ persisted: boolean }> {
  if (args.events.length === 0) return { persisted: true };
  try {
    const admin = createSupabaseAdminClient();
    const rows = args.events.map((e) => ({
      run_id: e.runId,
      stage: e.stage,
      provider: e.provider,
      model: e.model ?? null,
      input_tokens: e.inputTokens ?? null,
      output_tokens: e.outputTokens ?? null,
      unit_count: e.unitCount ?? null,
      usd: e.usd,
      latency_ms: e.latencyMs,
      created_at: e.createdAt,
      run_type: args.runType,
      entity_id: args.entityId ?? null,
    }));
    const { error } = await admin.from("query_costs").insert(rows);
    if (error) throw error;
    return { persisted: true };
  } catch (err) {
    console.error(
      `[costs] failed to persist ${args.events.length} cost event(s) for run ${args.events[0].runId}:`,
      err instanceof Error ? err.message : err,
    );
    return { persisted: false };
  }
}
