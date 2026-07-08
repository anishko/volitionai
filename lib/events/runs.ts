// match_runs helpers (ADR-0005): server-side run state that replaces the old
// client localStorage guard. The seed floor writes floor_ready, the live run
// advances the row, and the feed polls it - a failed or hung run is visible
// and retryable instead of a permanently empty feed.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRun, MatchRunStatus, NonprofitProfile } from "@/types";
import { persistCostEvents } from "@/lib/supabase/costs";
import { runEventMatch, type EventMatchRunResult } from "./run";

// Wall-clock budget for the live run. Stage-level timeouts should finish far
// sooner; this is the backstop that keeps a hung source from leaving the run
// in live_running forever (the status the UI treats as "still searching").
export const LIVE_RUN_WALL_CLOCK_MS = 150_000;

export interface MatchRunRow {
  id: string;
  profile_id: string;
  status: MatchRunStatus;
  notices: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export function rowToMatchRun(row: MatchRunRow): MatchRun {
  return {
    id: row.id,
    profileId: row.profile_id,
    status: row.status,
    notices: row.notices ?? [],
    error: row.error ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

export async function createMatchRun(
  admin: SupabaseClient,
  profileId: string,
  status: MatchRunStatus,
): Promise<MatchRun> {
  const { data, error } = await admin
    .from("match_runs")
    .insert({ profile_id: profileId, status })
    .select("*")
    .single();
  if (error) throw error;
  return rowToMatchRun(data as MatchRunRow);
}

export async function updateMatchRun(
  admin: SupabaseClient,
  runId: string,
  patch: { status?: MatchRunStatus; notices?: string[]; error?: string | null; finished?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.notices) row.notices = patch.notices;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.finished) row.finished_at = new Date().toISOString();
  const { error } = await admin.from("match_runs").update(row).eq("id", runId);
  if (error) throw error;
}

/** Latest run for a profile; works with the user-scoped client (owner RLS). */
export async function latestMatchRun(
  supabase: SupabaseClient,
  profileId: string,
): Promise<MatchRun | null> {
  const { data, error } = await supabase
    .from("match_runs")
    .select("*")
    .eq("profile_id", profileId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToMatchRun(data as MatchRunRow) : null;
}

function timeoutAfter(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

/**
 * Run the live match pipeline with run-state tracking. Never throws: every
 * outcome (success, failure, wall-clock timeout) lands in the match_runs row,
 * because a silent failure is exactly the bug this replaces.
 *
 * Returns the pipeline result on success, null on failure/timeout.
 */
export async function runLiveMatchTracked(
  admin: SupabaseClient,
  profile: NonprofitProfile,
  runId: string,
): Promise<EventMatchRunResult | null> {
  try {
    await updateMatchRun(admin, runId, { status: "live_running" });
  } catch (err) {
    console.warn("[events/runs] failed to mark live_running:", err instanceof Error ? err.message : err);
  }

  const pipeline = runEventMatch(admin, profile);
  // Persist costs + final state whenever the pipeline actually finishes -
  // even after a wall-clock timeout already marked the run failed. Metering
  // is not optional, and a late "done" honestly supersedes "timed out".
  const settle = pipeline
    .then(async (result) => {
      await persistCostEvents({
        events: result.costEvents,
        runType: "event_match",
        entityId: profile.id,
      });
      await updateMatchRun(admin, runId, {
        status: "done",
        notices: result.meta.notices,
        error: null,
        finished: true,
      });
      return result;
    })
    .catch(async (err) => {
      console.error("[events/runs] live match failed:", err);
      await updateMatchRun(admin, runId, {
        status: "failed",
        error: err instanceof Error ? err.message : "Live event matching failed.",
        finished: true,
      }).catch(() => {});
      return null;
    });

  const winner = await Promise.race([settle, timeoutAfter(LIVE_RUN_WALL_CLOCK_MS)]);
  if (winner === "timeout") {
    await updateMatchRun(admin, runId, {
      status: "failed",
      error: `Live search exceeded the ${Math.round(LIVE_RUN_WALL_CLOCK_MS / 1000)}s time budget.`,
      finished: true,
    }).catch(() => {});
    return null;
  }
  return winner;
}
