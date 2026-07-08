"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleDollarSign,
  Clock,
  ExternalLink,
  MapPin,
  Mic2,
  RefreshCw,
  Ticket,
  Users,
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
import { feedBroadenedNotice, matchTierLabel } from "@/lib/events/match-tier-label";
import { CostReceiptCard } from "@/components/cost-receipt";
import type { Event, EventMatchStatus, MatchRun, PlanChecklistItem } from "@/types";
import type { CostReceipt } from "@/types/cost";
import type { PeerOrg } from "@/types/peer";

interface PlanEntry {
  plan: {
    id: string;
    eventId: string;
    participationTier?: string;
    checklist: PlanChecklistItem[];
    registrationCost?: number;
    registrationCostSourceUrl?: string;
  };
  event: Event | null;
}

interface EventsFeedProps {
  profileId: string;
  initialItems: EventFeedItem[];
  initialRun: MatchRun | null;
  /** Receipt from a server-side match run, when available. The client also sets
   *  this after running a match this session. */
  initialReceipt?: CostReceipt;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

/** The trust signature: a subtle per-run cost line that expands to the
 *  stage-by-stage breakdown, plus any honest "we stopped at budget" notices. */
function ReceiptFooter({ receipt, notices }: { receipt: CostReceipt; notices: string[] }) {
  return (
    <details className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
        <CircleDollarSign className="size-3.5" />
        <span>
          This match run: <span className="font-medium text-zinc-700 dark:text-zinc-200">{fmtUsd(receipt.totalUsd)}</span>
          {" · "}
          {receipt.localTokenShare}% of tokens local
        </span>
        <span className="ml-auto text-zinc-400 group-open:hidden">details</span>
        <span className="ml-auto hidden text-zinc-400 group-open:inline">hide</span>
      </summary>
      <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-900">
        <CostReceiptCard receipt={receipt} />
        {notices.length > 0 && (
          <ul className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {notices.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

// A run still "active" this long after starting is presumed hung (the server
// budget is 150s); the feed stops polling and offers a retry instead.
const RUN_HUNG_AFTER_MS = 4 * 60 * 1000;
// A finished run older than this is stale; the corpus has likely moved on.
const RUN_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 4000;

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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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

  const [ogImage, setOgImage] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/og-image?url=${encodeURIComponent(item.event.website)}`)
      .then((r) => r.json())
      .then(({ imageUrl }: { imageUrl: string | null }) => {
        if (imageUrl) setOgImage(imageUrl);
      })
      .catch(() => {});
  }, [item.event.website]);

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
      : null);

  return (
    <Card className="overflow-hidden rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      {ogImage && (
        <div className="h-44 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <img
            src={ogImage}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setOgImage(null)}
          />
        </div>
      )}
      <CardHeader className="gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{formatDateRange(item.event.startDate, item.event.endDate)}</span>
            <span aria-hidden="true">/</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {formatLocation(item.event)}
            </span>
            {(() => {
              const tier = matchTierLabel(item.matchTier);
              if (!tier) return null;
              return (
                <span
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                  title={tier.tooltip}
                >
                  {tier.short}
                </span>
              );
            })()}
          </div>
          <CardTitle className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            <Link href={`/events/${item.event.id}`} className="hover:underline">
              {item.event.name}
            </Link>
          </CardTitle>
        </div>
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

        {item.evidence.length > 0 && (
          <div className="space-y-1.5">
            {item.evidence.slice(0, 3).map((e, i) => (
              <div key={i} className="flex items-baseline gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="shrink-0 font-mono text-zinc-400 dark:text-zinc-600">[{i + 1}]</span>
                <span className="min-w-0">
                  <span className="mr-1.5">{e.claim}</span>
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {hostnameOf(e.sourceUrl)}
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}

        {donorSignal && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
            <span className="font-medium text-zinc-950 dark:text-zinc-100">Donor signal: </span>
            {donorSignal}
          </div>
        )}

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
        <a
          href={item.event.website}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonVariants({ variant: "ghost", size: "sm" })} mr-auto`}
        >
          Visit site →
        </a>
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

const DAY_MS = 24 * 60 * 60 * 1000;

function nearestDeadline(event: Event | null): { date: number; label: string } | null {
  if (!event) return null;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const deadlines = event.participationTiers
    .filter((t) => t.deadline)
    .map((t) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.deadline!);
      if (!m) return null;
      return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const upcoming = deadlines.find((d) => d >= today);
  if (!upcoming) return null;
  const days = Math.ceil((upcoming - today) / DAY_MS);
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`;
  return { date: upcoming, label };
}

function sortPlanEntries(entries: PlanEntry[]): PlanEntry[] {
  const today = Date.now();
  return [...entries].sort((a, b) => {
    const da = nearestDeadline(a.event);
    const db = nearestDeadline(b.event);
    // Upcoming deadlines first (ascending)
    if (da && db) return da.date - db.date;
    if (da) return -1;
    if (db) return 1;
    // Then by event start date
    const sa = a.event?.startDate ? new Date(a.event.startDate).getTime() : Infinity;
    const sb = b.event?.startDate ? new Date(b.event.startDate).getTime() : Infinity;
    if (sa !== sb) return sa - sb;
    return (a.event?.name ?? "").localeCompare(b.event?.name ?? "");
  });
  void today;
}

function PlanCard({ entry }: { entry: PlanEntry }) {
  const { plan, event } = entry;
  if (!event) return null;

  const deadline = nearestDeadline(event);
  const isUrgent = deadline !== null && deadline.date - Date.now() <= 14 * DAY_MS;
  const completed = plan.checklist.filter((c) => c.completed).length;
  const total = plan.checklist.length;

  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const startLabel = event.startDate ? fmt.format(new Date(`${event.startDate}T00:00:00Z`)) : null;
  const endLabel = event.endDate && event.endDate !== event.startDate ? fmt.format(new Date(`${event.endDate}T00:00:00Z`)) : null;
  const dateLabel = startLabel ? (endLabel ? `${startLabel} – ${endLabel}` : startLabel) : "Date TBA";

  const locationParts = [event.locationCity, event.locationState, event.locationCountry].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : event.format?.replace("_", " ") ?? null;

  return (
    <Card className="rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/events/${event.id}`}
              className="font-semibold text-zinc-950 hover:underline underline-offset-2 dark:text-zinc-50"
            >
              {event.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" />
                {dateLabel}
              </span>
              {location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {location}
                </span>
              )}
              {plan.participationTier && (
                <span className="capitalize">{plan.participationTier}</span>
              )}
            </div>
          </div>
          {deadline && (
            <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
              isUrgent
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            }`}>
              {isUrgent && <AlertCircle className="size-3" />}
              <Clock className="size-3" />
              Deadline in {deadline.label}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {plan.registrationCost !== undefined && plan.registrationCost !== null && (
          <div className="flex items-center gap-2 text-sm">
            <CircleDollarSign className="size-4 text-zinc-400" />
            <span className="text-zinc-700 dark:text-zinc-300">
              Registration: <span className="font-medium">${plan.registrationCost.toLocaleString()}</span>
            </span>
            {plan.registrationCostSourceUrl && (
              <a href={plan.registrationCostSourceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-zinc-400 underline-offset-2 hover:underline">↗ source</a>
            )}
          </div>
        )}

        {total > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Checklist — {completed}/{total} done
              </p>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <ul className="space-y-1.5">
              {plan.checklist.slice(0, 5).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                    item.completed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}>
                    {item.completed && <Check className="size-2.5" />}
                  </span>
                  <span className={item.completed ? "text-zinc-400 line-through dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}>
                    {item.task}
                    {item.deadline && (
                      <span className="ml-1.5 font-mono text-xs text-zinc-400">
                        · due {item.deadline}
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {total > 5 && (
                <li className="text-xs text-zinc-400">+ {total - 5} more items</li>
              )}
            </ul>
          </div>
        )}

        <Link
          href={`/events/${event.id}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200"
        >
          <ExternalLink className="size-3" />
          View event details
        </Link>
      </CardContent>
    </Card>
  );
}

function PeerCard({ peer }: { peer: PeerOrg }) {
  return (
    <Card className="rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      <CardHeader className="gap-2 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {peer.name}
            </CardTitle>
            {peer.website && (
              <a
                href={peer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <ExternalLink className="size-3" />
                {(() => { try { return new URL(peer.website).hostname.replace("www.", ""); } catch { return peer.website; } })()}
              </a>
            )}
          </div>
          {peer.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <MapPin className="size-3" />
              {peer.location}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {peer.causeAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {peer.causeAreas.map((tag) => (
              <Badge key={tag} variant="secondary">{tag.replaceAll("_", " ")}</Badge>
            ))}
          </div>
        )}
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{peer.description}</p>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">Why comparable</p>
          <p className="text-zinc-700 dark:text-zinc-300">{peer.relevanceReason}</p>
        </div>
        {peer.strategy && (
          <div>
            <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">Strategy</p>
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{peer.strategy}</p>
          </div>
        )}
        {peer.partnerships.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">Known partnerships</p>
            <div className="flex flex-wrap gap-1.5">
              {peer.partnerships.map((p) => (
                <span key={p} className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{p}</span>
              ))}
            </div>
          </div>
        )}
        {peer.sourceUrl && (
          <a href={peer.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-zinc-400 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-200">
            ↗ source
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function EventsFeed({
  profileId,
  initialItems,
  initialRun,
  initialReceipt,
}: EventsFeedProps) {
  const [items, setItems] = useState(() => sortEventFeedItems(initialItems));
  const [activeTab, setActiveTab] = useState<"recommended" | "saved" | "plan" | "peers">("recommended");
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [peers, setPeers] = useState<PeerOrg[]>([]);
  const [isAnalyzingPeers, setIsAnalyzingPeers] = useState(false);
  const [peersError, setPeersError] = useState<string | null>(null);
  const [peersLoaded, setPeersLoaded] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [receipt, setReceipt] = useState<CostReceipt | null>(initialReceipt ?? null);
  const [runNotices, setRunNotices] = useState<string[]>(initialRun?.notices ?? []);
  const [run, setRun] = useState<MatchRun | null>(initialRun);
  // Wall-clock ticker (render-pure): drives the hung/stale checks. 0 until
  // mount, so both checks stay conservatively false during SSR/hydration.
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // async first tick keeps the effect body pure
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const runActive = run?.status === "floor_ready" || run?.status === "live_running";
  const runHung =
    now > 0 &&
    runActive &&
    run != null &&
    now - new Date(run.startedAt).getTime() > RUN_HUNG_AFTER_MS;
  const runStale =
    now > 0 &&
    run?.status === "done" &&
    run.finishedAt != null &&
    now - new Date(run.finishedAt).getTime() > RUN_STALE_AFTER_MS;
  // Retry is offered whenever there is no live search to wait for: never ran,
  // failed, hung, or the last success has gone stale.
  const showRetry = !isMatching && (!run || run.status === "failed" || runHung || runStale);

  // Poll the run state while the background live search works (ADR-0005);
  // results merge into the feed as the server writes them.
  useEffect(() => {
    if (!runActive || runHung) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/match?profileId=${encodeURIComponent(profileId)}`);
        if (!res.ok) return; // transient; keep polling until the hung cutoff
        const payload = await res.json();
        if (payload.run) setRun(payload.run);
        if (Array.isArray(payload.run?.notices)) {
          setRunNotices(payload.run.notices);
        }
        if (Array.isArray(payload.matches) && payload.matches.length > 0) {
          setItems(sortEventFeedItems(payload.matches));
        }
      } catch {
        // transient network failure; the next tick retries
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runActive, runHung, profileId]);

  async function runMatching() {
    setIsMatching(true);
    setError(null);
    try {
      const res = await fetch("/api/events/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (payload.run) setRun(payload.run);
      if (payload.receipt) setReceipt(payload.receipt as CostReceipt);
      setRunNotices(payload.meta?.notices ?? payload.run?.notices ?? []);
      if (!res.ok) {
        setError(payload.error ?? "Event matching failed.");
        return;
      }
      setItems(sortEventFeedItems(payload.matches ?? []));
    } finally {
      setIsMatching(false);
    }
  }

  const recommended = useMemo(
    () => items.filter((item) => item.status === "recommended"),
    [items],
  );
  const saved = useMemo(() => items.filter((item) => item.status === "saved"), [items]);
  const broadenedNotice = useMemo(
    () => feedBroadenedNotice(items.some((item) => item.matchTier !== "strict")),
    [items],
  );

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

  async function loadPlan() {
    setIsPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/plans");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setPlanError(payload.error ?? "Failed to load plan."); return; }
      setPlanEntries(sortPlanEntries(payload.plans ?? []));
      setPlanLoaded(true);
    } finally {
      setIsPlanLoading(false);
    }
  }

  async function runPeerAnalysis() {
    setIsAnalyzingPeers(true);
    setPeersError(null);
    try {
      const res = await fetch("/api/peers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setPeersError(payload.error ?? "Peer analysis failed."); return; }
      setPeers(payload.peers ?? []);
      setPeersLoaded(true);
    } finally {
      setIsAnalyzingPeers(false);
    }
  }

  function handleTabChange(value: string) {
    const tab = value as "recommended" | "saved" | "plan" | "peers";
    setActiveTab(tab);
    if (tab === "plan" && !planLoaded && !isPlanLoading) void loadPlan();
    if (tab === "peers" && !peersLoaded && !isAnalyzingPeers) void runPeerAnalysis();
  }

  const activeItems = activeTab === "recommended" ? recommended : saved;
  // The skeleton only stands in when there is nothing to show - a re-run must
  // never hide the cards the user already has.
  const showMatchingSkeleton = isMatching && recommended.length === 0 && activeTab === "recommended";

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="recommended">For You ({recommended.length})</TabsTrigger>
          <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            <CalendarPlus className="size-3.5" />
            My Plan
          </TabsTrigger>
          <TabsTrigger value="peers" className="gap-1.5">
            <Users className="size-3.5" />
            Peer Analysis
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-3">
          {isMatching ? (
            <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Clock className="size-4 animate-pulse" />
              Matching events
            </div>
          ) : runActive && !runHung ? (
            <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <RefreshCw className="size-4 animate-spin [animation-duration:2.5s]" />
              Searching live sources for more events
            </div>
          ) : null}
          {showRetry && (
            <Button type="button" variant="outline" size="sm" onClick={runMatching}>
              <RefreshCw />
              Find more events
            </Button>
          )}
        </div>
      </div>

      {(error ?? (run?.status === "failed" ? run.error : null) ?? (runHung ? "Live search is taking longer than expected." : null)) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {error ?? (run?.status === "failed" ? run.error : null) ?? "Live search is taking longer than expected."}{" "}
          {items.length > 0 && "Your matched events below are unaffected."}
        </div>
      )}

      {broadenedNotice && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
          {broadenedNotice}
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

      <TabsContent value="plan" className="space-y-4">
        {isPlanLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : planError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {planError}
          </div>
        ) : planEntries.length > 0 ? (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {planEntries.length} event{planEntries.length !== 1 ? "s" : ""} · sorted by registration deadline, then event date
            </p>
            {planEntries.map((entry) => (
              <PlanCard key={entry.plan.id} entry={entry} />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPlan()} disabled={isPlanLoading}>
              <RefreshCw className={isPlanLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No events in your plan yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Use the "Add to Plan" button on any event card to track it here.
            </p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="peers" className="space-y-4">
        {isAnalyzingPeers ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
            <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Clock className="size-4 animate-pulse" />
              Researching peer organizations…
            </div>
          </div>
        ) : peersError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
            {peersError}
          </div>
        ) : peers.length > 0 ? (
          <>
            {peers.map((peer, i) => <PeerCard key={`${peer.name}-${i}`} peer={peer} />)}
            <Button type="button" variant="outline" size="sm" disabled={isAnalyzingPeers} onClick={() => void runPeerAnalysis()}>
              <RefreshCw className={isAnalyzingPeers ? "animate-spin" : ""} />
              Refresh
            </Button>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No peer analysis yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Click the tab to auto-run, or wait a moment for results.
            </p>
          </div>
        )}
      </TabsContent>

      {receipt && <ReceiptFooter receipt={receipt} notices={runNotices} />}

      {activeItems.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Sorted by match score with a small bump for registration deadlines inside 30 days.
        </p>
      )}
    </Tabs>
  );
}
