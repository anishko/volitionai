// Mapping between the event_debriefs table (snake_case; see migrations
// 20260707000700 + 20260708060422_debrief_actuals) and the app-facing
// EventDebrief contract in types/index.ts. Mirrors lib/plans/plan-row.ts.
import type { DebriefOutcome, EventDebrief } from "@/types";

export interface EventDebriefRow {
  id: string;
  plan_id: string;
  worth_it: number | null;
  outcome: string | null;
  actual_spend_usd: number | null;
  leads_gained: number | null;
  contacts_gained: number | null;
  notes: string | null;
  created_at: string;
}

/** Column list for select() — keeps the shape in one place. */
export const DEBRIEF_COLUMNS =
  "id, plan_id, worth_it, outcome, actual_spend_usd, leads_gained, contacts_gained, notes, created_at";

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const outcome = (v: unknown): DebriefOutcome | undefined =>
  v === "attended" || v === "skipped" ? v : undefined;

export function rowToEventDebrief(row: EventDebriefRow): EventDebrief {
  return {
    id: row.id,
    planId: row.plan_id,
    worthIt: num(row.worth_it),
    outcome: outcome(row.outcome),
    actualSpendUsd: num(row.actual_spend_usd),
    leadsGained: num(row.leads_gained),
    contactsGained: num(row.contacts_gained),
    notes: str(row.notes),
    createdAt: row.created_at,
  };
}
