import type { Event, EventMatch } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const URGENCY_WINDOW_DAYS = 30;
const URGENCY_SORT_BUMP = 5;

export interface RegistrationUrgency {
  deadline: string;
  daysUntilDeadline: number;
  label: string;
}

export type EventFeedItem = EventMatch & {
  event: Event;
  urgency?: RegistrationUrgency;
};

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseDateOnly(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function urgencyLabel(days: number): string {
  if (days === 0) return "Registration closes today";
  if (days === 1) return "Registration closes tomorrow";
  return `Registration closes in ${days} days`;
}

export function registrationUrgency(
  event: Event,
  now = new Date(),
): RegistrationUrgency | undefined {
  const today = startOfUtcDay(now);
  const upcoming = event.participationTiers
    .flatMap((tier) => {
      if (!tier.deadline) return [];
      const deadlineTime = parseDateOnly(tier.deadline);
      if (deadlineTime === undefined) return [];
      const daysUntilDeadline = Math.ceil((deadlineTime - today) / DAY_MS);
      if (daysUntilDeadline < 0 || daysUntilDeadline > URGENCY_WINDOW_DAYS) return [];
      return [{ deadline: tier.deadline, daysUntilDeadline }];
    })
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);

  const nearest = upcoming[0];
  return nearest ? { ...nearest, label: urgencyLabel(nearest.daysUntilDeadline) } : undefined;
}

export function withFeedMetadata(
  item: EventMatch & { event: Event },
  now = new Date(),
): EventFeedItem {
  return { ...item, urgency: registrationUrgency(item.event, now) };
}

export function sortEventFeedItems<T extends EventMatch & { event: Event }>(
  items: T[],
  now = new Date(),
): EventFeedItem[] {
  return items
    .map((item) => withFeedMetadata(item, now))
    .sort((a, b) => {
      const aScore = a.matchScore + (a.urgency ? URGENCY_SORT_BUMP : 0);
      const bScore = b.matchScore + (b.urgency ? URGENCY_SORT_BUMP : 0);
      if (aScore !== bScore) return bScore - aScore;
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
      const aDeadline = a.urgency?.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
      const bDeadline = b.urgency?.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
      return a.event.name.localeCompare(b.event.name);
    });
}
