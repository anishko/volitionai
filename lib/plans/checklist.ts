// Participation-tier checklist templates (PRD → Planning feature / checklist
// templates). Generation is DETERMINISTIC — pure templates plus the event's
// own cited tier deadlines — so plan creation makes no model call and costs $0.
// (If a future version drafts checklist copy with a model, meter it via
// query_costs with run_type 'plan'.) Sourced deadlines carry their source_url;
// where a scrape found none, the item is left dateless and the UI renders
// "deadline unknown — check event site" rather than a guessed date.
import type { Event, EventParticipationTier, PlanChecklistItem } from "@/types";

export type PlanTier = "attending" | "speaking" | "sponsoring";

/** Map any stored/entered tier label onto the three canonical checklist tiers. */
export function normalizeTier(raw?: string): PlanTier {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("speak") || v.includes("cfp") || v.includes("present")) return "speaking";
  if (v.includes("sponsor") || v.includes("exhibit") || v.includes("booth")) return "sponsoring";
  return "attending";
}

/** Find the event tier whose name best matches a checklist tier, for deadlines/costs. */
export function findEventTier(
  event: Event,
  tier: PlanTier,
): EventParticipationTier | undefined {
  const tiers = event.participationTiers ?? [];
  const match = (pred: (t: string) => boolean) =>
    tiers.find((t) => pred(t.tier.toLowerCase()));
  if (tier === "speaking") {
    return match((t) => t.includes("speak") || t.includes("cfp") || t.includes("present"));
  }
  if (tier === "sponsoring") {
    return match((t) => t.includes("sponsor") || t.includes("exhibit") || t.includes("booth"));
  }
  return (
    match((t) => t.includes("attend") || t.includes("register") || t.includes("general")) ??
    tiers[0]
  );
}

function deadlineFields(
  tier: EventParticipationTier | undefined,
): Pick<PlanChecklistItem, "deadline" | "deadlineSourceUrl"> {
  // Citation or no deadline: only attach a date when the scrape sourced one.
  if (tier?.deadline && tier.sourceUrl) {
    return { deadline: tier.deadline, deadlineSourceUrl: tier.sourceUrl };
  }
  return {};
}

function item(task: string, extra?: Partial<PlanChecklistItem>): PlanChecklistItem {
  return { task, completed: false, ...extra };
}

/**
 * Build the tier-appropriate checklist for a plan. Registration / CFP /
 * sponsorship deadlines are auto-filled from the event's cited tiers; travel,
 * hotel, and prep tasks carry a suggested cadence in their text (not a sourced
 * date), so they stay dateless — never a guessed deadline.
 */
export function buildChecklist(event: Event, rawTier?: string): PlanChecklistItem[] {
  const tier = normalizeTier(rawTier);

  const attendTier = findEventTier(event, "attending");
  const attending: PlanChecklistItem[] = [
    item("Register for event", deadlineFields(attendTier)),
    item("Book travel (suggested: 60 days before)"),
    item("Book hotel (suggested: 60 days before)"),
    item("Research attendees and speakers to prioritize"),
    item("Prepare 30-second org pitch"),
    item("Identify 3 donor prospects to meet"),
  ];

  if (tier === "speaking") {
    const cfpTier = findEventTier(event, "speaking");
    return [
      ...attending,
      item("Submit CFP", deadlineFields(cfpTier)),
      item("Confirm speaking slot accepted"),
      item("Prepare talk / slides"),
      item("Prep post-talk follow-up materials"),
    ];
  }

  if (tier === "sponsoring") {
    const sponsorTier = findEventTier(event, "sponsoring");
    return [
      ...attending,
      item("Submit sponsorship application", deadlineFields(sponsorTier)),
      item("Design booth or branded materials"),
      item("Prepare sponsor activation plan"),
    ];
  }

  return attending;
}
