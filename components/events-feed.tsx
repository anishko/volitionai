"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  CalendarPlus,
  Check,
  CircleDollarSign,
  Clock,
  MapPin,
  Mic2,
  Ticket,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortEventFeedItems, type EventFeedItem } from "@/lib/events/feed-item";
import type { EventMatchStatus } from "@/types";

interface EventsFeedProps {
  profileId: string;
  initialItems: EventFeedItem[];
}

type MatchActionStatus = Extract<EventMatchStatus, "saved" | "dismissed">;

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return "Date TBA";
  const fmt = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
  if (!endDate || endDate === startDate) return start;
  return `${start} - ${fmt.format(new Date(`${endDate}T00:00:00Z`))}`;
}

function formatLocation(event: EventFeedItem["event"]): string {
  return [event.locationCity, event.locationState, event.locationCountry]
    .filter(Boolean)
    .join(", ") || event.format?.replace("_", " ") || "Location TBA";
}

function tierKinds(event: EventFeedItem["event"]) {
  const tiers = event.participationTiers.map((t) => t.tier.toLowerCase());
  return [
    { key: "attendee", label: "Attendee", icon: Ticket },
    { key: "speaker", label: "Speaker", icon: Mic2 },
    { key: "sponsor", label: "Sponsor", icon: CircleDollarSign },
  ].map((tier) => ({
    ...tier,
    available: tiers.some((value) => value.includes(tier.key)),
  }));
}

function EmptyState({ tab }: { tab: "recommended" | "saved" }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {tab === "recommended" ? "No recommended events yet." : "No saved events yet."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {tab === "recommended"
          ? "When matching returns events, they will appear here in score order."
          : "Saved matches move here instantly so you can compare them later."}
      </p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-label="Matching events">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="w-full space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <Skeleton className="h-12 w-16" />
          </div>
          <Skeleton className="mt-5 h-16 w-full" />
          <Skeleton className="mt-4 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function EventCard({
  item,
  pending,
  onStatusChange,
}: {
  item: EventFeedItem;
  pending: boolean;
  onStatusChange: (id: string, status: MatchActionStatus) => void;
}) {
  const tiers = tierKinds(item.event);
  // "Add to Plan" — the one planning entry point on the card (Phase 6). Creates
  // a plan from this match; POST is idempotent, so a re-add is a no-op.
  const [addState, setAddState] = useState<"idle" | "pending" | "added" | "error">("idle");
  async function addToPlan() {
    setAddState("pending");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: item.id }),
      });
      setAddState(res.ok ? "added" : "error");
    } catch {
      setAddState("error");
    }
  }

  const firstDonorSignal = item.event.donorSignals[0];
  const donorSignal =
    item.donorSignalCallout ??
    (firstDonorSignal
      ? `${firstDonorSignal.foundationName} appears in event donor signals${
          firstDonorSignal.focusArea ? ` for ${firstDonorSignal.focusArea}` : ""
        }`
      : "No verified donor signal available");

  return (
    <Card className="rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      <CardHeader className="gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{formatDateRange(item.event.startDate, item.event.endDate)}</span>
            <span aria-hidden="true">/</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {formatLocation(item.event)}
            </span>
          </div>
          <CardTitle className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {item.event.name}
          </CardTitle>
        </div>
        <CardAction>
          <div className="rounded-lg border border-zinc-200 px-3 py-2 text-center dark:border-zinc-800">
            <div className="text-xl font-semibold leading-none text-zinc-950 dark:text-zinc-50">
              {item.matchScore}
            </div>
            <div className="mt-1 text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500">
              match
            </div>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {item.event.causeAreaTags.slice(0, 6).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag.replaceAll("_", " ")}
            </Badge>
          ))}
        </div>

        {item.urgency && (
          <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <Clock className="size-4" />
            {item.urgency.label}
          </div>
        )}

        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {item.whyAttend || "This event matched your profile, but the explanation is still being generated."}
        </p>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
          <span className="font-medium text-zinc-950 dark:text-zinc-100">Donor signal: </span>
          {donorSignal}
        </div>

        <div className="flex flex-wrap gap-2">
          {tiers.map(({ key, label, icon: Icon, available }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                available
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
              }`}
              title={`${label} ${available ? "available" : "not listed"}`}
            >
              <Icon className="size-3.5" />
              {label}
            </span>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-2 bg-zinc-50 dark:bg-zinc-900/60">
        {item.status === "recommended" ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onStatusChange(item.id, "saved")}
          >
            <Bookmark />
            Save
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled>
            <Bookmark />
            Saved
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => onStatusChange(item.id, "dismissed")}
        >
          <X />
          Dismiss
        </Button>
        {addState === "added" ? (
          <Link href="/plan" className={buttonVariants({ variant: "secondary" })}>
            <Check />
            Added — view plan
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={addState === "pending"}
            onClick={addToPlan}
            title={addState === "error" ? "Could not add — try again" : "Add to Plan"}
          >
            <CalendarPlus />
            {addState === "error" ? "Retry add to plan" : "Add to Plan"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function EventsFeed({ profileId, initialItems }: EventsFeedProps) {
  const [items, setItems] = useState(() => sortEventFeedItems(initialItems));
  const [activeTab, setActiveTab] = useState<"recommended" | "saved">("recommended");
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    const storageKey = `volition:event-match-started:${profileId}`;
    if (initialItems.length > 0 || window.localStorage.getItem(storageKey)) return;

    window.localStorage.setItem(storageKey, new Date().toISOString());
    void (async () => {
      setIsMatching(true);
      setError(null);
      try {
        const res = await fetch("/api/events/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(payload.error ?? "Event matching failed.");
          return;
        }
        setItems(sortEventFeedItems(payload.matches ?? []));
      } finally {
        setIsMatching(false);
      }
    })();
  }, [initialItems.length, profileId]);

  const recommended = useMemo(
    () => items.filter((item) => item.status === "recommended"),
    [items],
  );
  const saved = useMemo(() => items.filter((item) => item.status === "saved"), [items]);

  async function updateStatus(id: string, status: MatchActionStatus) {
    const previous = items;
    setPendingIds((ids) => new Set(ids).add(id));
    setError(null);
    setItems((current) =>
      sortEventFeedItems(
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      ),
    );

    const res = await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setItems(previous);
      setError(payload.error ?? "Could not update the match.");
    }
    setPendingIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  const activeItems = activeTab === "recommended" ? recommended : saved;
  const showMatchingSkeleton = isMatching && activeTab === "recommended";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "recommended" | "saved")}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="recommended">For You ({recommended.length})</TabsTrigger>
          <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
        </TabsList>
        {isMatching && (
          <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Clock className="size-4 animate-pulse" />
            Matching events
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <TabsContent value="recommended" className="space-y-4">
        {showMatchingSkeleton ? (
          <FeedSkeleton />
        ) : recommended.length > 0 ? (
          recommended.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              pending={pendingIds.has(item.id)}
              onStatusChange={updateStatus}
            />
          ))
        ) : (
          <EmptyState tab="recommended" />
        )}
      </TabsContent>

      <TabsContent value="saved" className="space-y-4">
        {saved.length > 0 ? (
          saved.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              pending={pendingIds.has(item.id)}
              onStatusChange={updateStatus}
            />
          ))
        ) : (
          <EmptyState tab="saved" />
        )}
      </TabsContent>

      {activeItems.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Sorted by match score with a small bump for registration deadlines inside 30 days.
        </p>
      )}
    </Tabs>
  );
}
