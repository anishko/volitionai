"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Minus, Plus, Printer, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AnnualCandidate, AnnualPlan } from "@/lib/plans/annual";

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso?: string): string {
  if (!iso) return "Dates TBA";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(`${m[0]}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function locationOf(event: AnnualCandidate["event"]): string {
  const parts = [event.locationCity, event.locationState, event.locationCountry].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return event.format ? event.format.replace("_", " ") : "Location TBA";
}

export function AnnualPlanBoard({ initial }: { initial: AnnualPlan }) {
  const [annual, setAnnual] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slate = annual.candidates.filter((c) => c.inSlate);
  const available = annual.candidates.filter((c) => !c.inSlate && c.matchId);

  const grandTotal = annual.citedTotal + annual.travelEstimateTotal;
  const cap = annual.annualBudgetCap;
  const overCap = cap != null && grandTotal > cap;

  async function refresh() {
    const res = await fetch("/api/plans/annual");
    const payload = await res.json().catch(() => ({}));
    if (res.ok && payload.annual) setAnnual(payload.annual as AnnualPlan);
    else setError(payload.error ?? "Could not refresh the annual plan.");
  }

  async function addToSlate(matchId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not add the event.");
    } else {
      await refresh();
    }
    setBusy(false);
  }

  async function removeFromSlate(planId?: string) {
    if (!planId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not remove the event.");
    } else {
      await refresh();
    }
    setBusy(false);
  }

  // Greedy propose: add cap-fitting available events (highest score first) whose
  // CITED cost keeps the running registration total within the cap. Events with
  // an unverified cost are never auto-added (they'd distort a board total).
  async function proposeSlate() {
    if (cap == null) return;
    setBusy(true);
    setError(null);
    let running = annual.citedTotal;
    const toAdd: string[] = [];
    for (const c of available) {
      if (!c.matchId || c.registrationCost == null) continue;
      if (running + c.registrationCost.amount <= cap) {
        toAdd.push(c.matchId);
        running += c.registrationCost.amount;
      }
    }
    try {
      for (const matchId of toAdd) {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? "Could not add an event.");
        }
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propose failed.");
    }
    setBusy(false);
  }

  async function saveTravel(planId: string | undefined, raw: string) {
    if (!planId) return;
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError("Travel estimate must be a non-negative number.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimatedTravelCost: value }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not save the travel estimate.");
      return;
    }
    // Reflect the new estimate locally without a full round-trip refetch.
    setAnnual((prev) => {
      const candidates = prev.candidates.map((c) =>
        c.planId === planId ? { ...c, estimatedTravelCost: value ?? undefined } : c,
      );
      const inSlate = candidates.filter((c) => c.inSlate);
      return {
        ...prev,
        candidates,
        travelEstimateTotal: inSlate.reduce((s, c) => s + (c.estimatedTravelCost ?? 0), 0),
      };
    });
  }

  return (
    <div className="space-y-6">
      {/* Running total vs cap */}
      <div
        className={`rounded-lg border px-4 py-4 ${
          cap == null
            ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            : overCap
              ? "border-red-300 bg-red-50 dark:border-red-900/70 dark:bg-red-950/40"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {usd(grandTotal)}
            {cap != null && (
              <span className="text-zinc-500 dark:text-zinc-400"> of {usd(cap)} cap</span>
            )}
          </div>
          {cap != null ? (
            <div
              className={`text-sm font-medium ${
                overCap
                  ? "text-red-700 dark:text-red-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {overCap
                ? `Over cap by ${usd(grandTotal - cap)}`
                : `${usd(cap - grandTotal)} remaining`}
            </div>
          ) : (
            <Link href="/profile" className="text-sm font-medium text-zinc-600 underline underline-offset-2 dark:text-zinc-300">
              Set an annual budget cap
            </Link>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Registration (cited): {usd(annual.citedTotal)} · Travel (estimated):{" "}
          {usd(annual.travelEstimateTotal)} · {annual.slateCount} in slate
          {annual.unverifiedInSlate > 0
            ? ` · ${annual.unverifiedInSlate} with unverified cost (excluded)`
            : ""}
          {annual.period ? ` · period ${annual.period}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || cap == null || available.length === 0}
          onClick={proposeSlate}
          title={cap == null ? "Set a budget cap to propose a slate" : "Propose a cap-fitting slate"}
        >
          <Wand2 className="size-4" />
          Propose slate
        </Button>
        <Link
          href="/api/plans/annual/export"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white dark:border-zinc-800 dark:text-zinc-200"
        >
          <Printer className="size-4" />
          Export / print
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Slate */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          This year&apos;s slate ({slate.length})
        </h2>
        {slate.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No events in the slate yet. Add from below, or Propose a cap-fitting slate.
          </p>
        ) : (
          slate.map((c) => (
            <SlateRow key={c.event.id} candidate={c} busy={busy} onRemove={removeFromSlate} onSaveTravel={saveTravel} />
          ))
        )}
      </section>

      {/* Available */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Available to add ({available.length})
        </h2>
        {available.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No more matched events to add. Save events from the{" "}
            <Link href="/events" className="underline underline-offset-2">
              Events
            </Link>{" "}
            feed to grow the candidate pool.
          </p>
        ) : (
          available.map((c) => (
            <AvailableRow key={c.event.id} candidate={c} busy={busy} onAdd={addToSlate} />
          ))
        )}
      </section>
    </div>
  );
}

function CostDisplay({ candidate }: { candidate: AnnualCandidate }) {
  if (!candidate.registrationCost) {
    return (
      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
        cost unverified
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
      {usd(candidate.registrationCost.amount)}
      <a
        href={candidate.registrationCost.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 text-xs font-normal text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400"
      >
        source <ExternalLink className="size-3" />
      </a>
    </span>
  );
}

function SlateRow({
  candidate,
  busy,
  onRemove,
  onSaveTravel,
}: {
  candidate: AnnualCandidate;
  busy: boolean;
  onRemove: (planId?: string) => void;
  onSaveTravel: (planId: string | undefined, raw: string) => void;
}) {
  const [travel, setTravel] = useState(
    candidate.estimatedTravelCost != null ? String(candidate.estimatedTravelCost) : "",
  );
  return (
    <Card className="rounded-lg border-zinc-200 shadow-none dark:border-zinc-800">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              <Link href={`/events/${candidate.event.id}`} className="hover:underline">
                {candidate.event.name}
              </Link>
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {fmtDate(candidate.event.startDate)} · {locationOf(candidate.event)}
              {candidate.participationTier ? ` · ${candidate.participationTier}` : ""}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {candidate.matchScore} match
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
            Registration
          </div>
          <CostDisplay candidate={candidate} />
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
            Travel
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold normal-case text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              estimate
            </span>
          </label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-zinc-500">$</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={travel}
              disabled={busy}
              onChange={(e) => setTravel(e.target.value)}
              onBlur={() => onSaveTravel(candidate.planId, travel)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="0"
              className="h-9 w-28"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onRemove(candidate.planId)}
        >
          <Minus className="size-4" />
          Remove
        </Button>
      </CardContent>
    </Card>
  );
}

function AvailableRow({
  candidate,
  busy,
  onAdd,
}: {
  candidate: AnnualCandidate;
  busy: boolean;
  onAdd: (matchId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0">
        <Link
          href={`/events/${candidate.event.id}`}
          className="text-sm font-semibold text-zinc-950 hover:underline dark:text-zinc-50"
        >
          {candidate.event.name}
        </Link>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {fmtDate(candidate.event.startDate)} · {locationOf(candidate.event)} · {candidate.matchScore} match
        </p>
      </div>
      <div className="flex items-center gap-3">
        <CostDisplay candidate={candidate} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !candidate.matchId}
          onClick={() => candidate.matchId && onAdd(candidate.matchId)}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
