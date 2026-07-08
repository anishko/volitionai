// Mapping between the event_plans table (snake_case; see
// supabase/migrations/20260707000600 + 000700) and an app-facing plan shape.
// types/index.ts already exports EventPlan + PlanChecklistItem; the v3 budget
// columns (budget_period, registration_cost, estimated_travel_cost, …) are not
// on that contract, so we extend it additively here rather than editing the
// shared type. Every sourced number keeps its source_url + verified_at.
import type { EventPlan, PlanChecklistItem } from "@/types";

export interface EventPlanRow {
  id: string;
  profile_id: string;
  event_id: string;
  participation_tier: string | null;
  checklist: Record<string, unknown>[];
  budget_period: string | null;
  registration_cost: number | null;
  registration_cost_source_url: string | null;
  registration_cost_verified_at: string | null;
  estimated_travel_cost: number | null;
  calendar_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** v3 budget fields carried alongside the base EventPlan contract. */
export interface PlanBudgetFields {
  budgetPeriod?: string;
  /** SOURCED snapshot of the chosen tier's cited registration cost. */
  registrationCost?: number;
  registrationCostSourceUrl?: string;
  registrationCostVerifiedAt?: string;
  /** ESTIMATE only — never presented as sourced (UI labels it "estimate"). */
  estimatedTravelCost?: number;
}

export type EventPlanFull = EventPlan & PlanBudgetFields;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function checklistFromJson(raw: Record<string, unknown>[]): PlanChecklistItem[] {
  return (raw ?? []).flatMap((c): PlanChecklistItem[] => {
    const task = str(c.task);
    if (!task) return [];
    return [
      {
        task,
        deadline: str(c.deadline),
        deadlineSourceUrl: str(c.deadline_source_url),
        completed: c.completed === true,
        calendarEventId: str(c.calendar_event_id),
      },
    ];
  });
}

export function checklistToJson(items: PlanChecklistItem[]): Record<string, unknown>[] {
  return items.map((item) => ({
    task: item.task,
    deadline: item.deadline ?? null,
    deadline_source_url: item.deadlineSourceUrl ?? null,
    completed: item.completed === true,
    calendar_event_id: item.calendarEventId ?? null,
  }));
}

export function rowToEventPlan(row: EventPlanRow): EventPlanFull {
  return {
    id: row.id,
    profileId: row.profile_id,
    eventId: row.event_id,
    participationTier: row.participation_tier ?? undefined,
    checklist: checklistFromJson(row.checklist),
    calendarSyncedAt: row.calendar_synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    budgetPeriod: row.budget_period ?? undefined,
    registrationCost: num(row.registration_cost),
    registrationCostSourceUrl: row.registration_cost_source_url ?? undefined,
    registrationCostVerifiedAt: row.registration_cost_verified_at ?? undefined,
    estimatedTravelCost: num(row.estimated_travel_cost),
  };
}
