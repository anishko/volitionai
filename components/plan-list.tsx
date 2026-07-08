"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, ChevronRight, ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Event, PlanChecklistItem } from "@/types";
import type { EventPlanFull } from "@/lib/plans/plan-row";

export interface PlanWithEvent {
  plan: EventPlanFull;
  event: Event | null;
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(`${m[0]}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function tierLabel(tier?: string): string {
  if (!tier) return "Attending";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function ChecklistRow({
  item,
  pending,
  onToggle,
}: {
  item: PlanChecklistItem;
  pending: boolean;
  onToggle: () => void;
}) {
  const deadline = formatDate(item.deadline);
  return (
    <li className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={item.completed}
        disabled={pending}
        onChange={onToggle}
        className="mt-1 size-4 shrink-0 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
        aria-label={item.completed ? `Mark "${item.task}" incomplete` : `Mark "${item.task}" complete`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            item.completed
              ? "text-zinc-400 line-through dark:text-zinc-600"
              : "text-zinc-800 dark:text-zinc-100"
          }`}
        >
          {item.task}
        </p>
        {deadline ? (
          <p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <CalendarClock className="size-3.5" />
            <span>Deadline {deadline}</span>
            {item.deadlineSourceUrl && (
              <a
                href={item.deadlineSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                source <ExternalLink className="size-3" />
              </a>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs italic text-zinc-400 dark:text-zinc-500">
            deadline unknown — check event site
          </p>
        )}
      </div>
    </li>
  );
}

function PlanCard({ initial }: { initial: PlanWithEvent }) {
  const { event } = initial;
  const [plan, setPlan] = useState(initial.plan);
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");

  const completed = plan.checklist.filter((c) => c.completed).length;
  const total = plan.checklist.length;

  async function persist(checklist: PlanChecklistItem[]) {
    const previous = plan.checklist;
    setPlan((p) => ({ ...p, checklist }));
    setPending(true);
    setError(null);
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist }),
    });
    setPending(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setPlan((p) => ({ ...p, checklist: previous }));
      setError(payload.error ?? "Could not save the checklist.");
    }
  }

  function toggle(index: number) {
    persist(
      plan.checklist.map((item, i) =>
        i === index ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function addTask() {
    const task = newTask.trim();
    if (task.length === 0) return;
    setNewTask("");
    persist([...plan.checklist, { task, completed: false }]);
  }

  const title = event?.name ?? "Event (details unavailable)";
  const dateRange = formatDate(event?.startDate);

  return (
    <Card className="rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 items-start gap-2 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="mt-1 size-4 shrink-0 text-zinc-400" />
            ) : (
              <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-400" />
            )}
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {event ? (
                  <Link href={`/events/${event.id}`} className="hover:underline">
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {dateRange ? `${dateRange} · ` : ""}
                {completed}/{total} done
              </p>
            </div>
          </button>
          <Badge variant="secondary" className="shrink-0">
            {tierLabel(plan.participationTier)}
          </Badge>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {plan.checklist.map((item, i) => (
              <ChecklistRow
                key={`${item.task}-${i}`}
                item={item}
                pending={pending}
                onToggle={() => toggle(i)}
              />
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTask();
                }
              }}
              placeholder="Add a custom task"
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || newTask.trim().length === 0}
              onClick={addTask}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function PlanList({ initialPlans }: { initialPlans: PlanWithEvent[] }) {
  if (initialPlans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No plans yet.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Add an event to a plan from the{" "}
          <Link href="/events" className="underline underline-offset-2">
            Events
          </Link>{" "}
          feed to generate its deadline checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {initialPlans.map((entry) => (
        <PlanCard key={entry.plan.id} initial={entry} />
      ))}
    </div>
  );
}
