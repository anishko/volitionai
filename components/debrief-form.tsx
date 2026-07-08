"use client";

// /debriefs/[matchId] — post-event debrief (Phase 7, v1.5). Two sides:
//   PLANNED  — the plan's SOURCED figures (registration cost keeps its source
//              link + verified date; travel is a labeled ESTIMATE, never cited).
//   ACTUAL   — the org's OWN reported results (spend, leads, contacts, outcome,
//              worth-it, notes). User input, so no citations apply.
// Loads plan + any existing debrief from GET /api/debriefs?matchId=. Create goes
// to POST /api/debriefs; edits to PATCH /api/debriefs/[id]. There is no delete
// affordance — debriefs are append-only by design.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebriefOutcome, EventDebrief } from "@/types";
import type { EventPlanFull } from "@/lib/plans/plan-row";

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtStamp(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** "" → null (clear); non-numeric / negative → "invalid". */
function parseMoney(raw: string): number | null | "invalid" {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}
function parseCount(raw: string): number | null | "invalid" {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}

interface LoadResult {
  plan: EventPlanFull | null;
  debrief: EventDebrief | null;
  planExists: boolean;
  eventId?: string | null;
}

export function DebriefForm({ matchId, eventName }: { matchId: string; eventName: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [data, setData] = useState<LoadResult | undefined>();

  // Actual-side fields (kept as strings for controlled inputs where numeric).
  const [debriefId, setDebriefId] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<DebriefOutcome | undefined>();
  const [worthIt, setWorthIt] = useState<number | undefined>();
  const [actualSpend, setActualSpend] = useState("");
  const [leads, setLeads] = useState("");
  const [contacts, setContacts] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const hydrate = useCallback((d: EventDebrief | null) => {
    setDebriefId(d?.id);
    setOutcome(d?.outcome);
    setWorthIt(d?.worthIt);
    setActualSpend(d?.actualSpendUsd != null ? String(d.actualSpendUsd) : "");
    setLeads(d?.leadsGained != null ? String(d.leadsGained) : "");
    setContacts(d?.contactsGained != null ? String(d.contactsGained) : "");
    setNotes(d?.notes ?? "");
  }, []);

  // Load the plan + any existing debrief once on mount. All setState happens
  // after the await (never synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/debriefs?matchId=${encodeURIComponent(matchId)}`);
        const json = (await res.json()) as LoadResult & { error?: string };
        if (!res.ok) throw new Error(json?.error ?? "Failed to load debrief.");
        if (cancelled) return;
        setData(json);
        hydrate(json.debrief);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load debrief.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, hydrate]);

  const save = useCallback(async () => {
    setSaveError(undefined);
    const spend = parseMoney(actualSpend);
    if (spend === "invalid") return setSaveError("Actual spend must be a non-negative number.");
    const leadsN = parseCount(leads);
    if (leadsN === "invalid") return setSaveError("Leads gained must be a non-negative whole number.");
    const contactsN = parseCount(contacts);
    if (contactsN === "invalid") return setSaveError("Contacts gained must be a non-negative whole number.");

    const payload = {
      worthIt: worthIt ?? null,
      outcome: outcome ?? null,
      actualSpendUsd: spend,
      leadsGained: leadsN,
      contactsGained: contactsN,
      notes: notes.trim() ? notes.trim() : null,
    };

    setSaving(true);
    try {
      let persisted: EventDebrief;
      if (debriefId) {
        const res = await fetch(`/api/debriefs/${debriefId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Could not save.");
        persisted = json.debrief as EventDebrief;
      } else {
        const res = await fetch(`/api/debriefs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Could not save.");
        persisted = json.debrief as EventDebrief;
        // A concurrent create can return the existing (untouched) row; apply our
        // edits with a follow-up PATCH so nothing is silently dropped.
        if (json.alreadyExisted && persisted?.id) {
          const patch = await fetch(`/api/debriefs/${persisted.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const pjson = await patch.json();
          if (!patch.ok) throw new Error(pjson?.error ?? "Could not save.");
          persisted = pjson.debrief as EventDebrief;
        }
      }
      hydrate(persisted);
      setData((d) => (d ? { ...d, debrief: persisted } : d));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [actualSpend, leads, contacts, worthIt, outcome, notes, debriefId, matchId, hydrate]);

  // ---- Loading / error / no-plan states -----------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-6 h-6 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      </div>
    );
  }

  if (data && !data.planExists) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Event debrief</p>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{eventName}</h1>
        </header>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            A debrief compares what you <em>planned</em> to spend against what actually happened —
            so it needs a plan first. Add this event to your plan, then come back to log the results.
          </p>
          {data.eventId && (
            <Link
              href={`/events/${data.eventId}`}
              className={`mt-4 ${buttonVariants({ size: "sm" })}`}
            >
              Add this event to your plan
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ---- Ready: planned-vs-actual -------------------------------------------

  const plan = data?.plan ?? null;
  const cited = plan?.registrationCost != null && !!plan.registrationCostSourceUrl;
  const verified = fmtStamp(plan?.registrationCostVerifiedAt);
  const plannedTotal =
    (plan?.registrationCost ?? 0) + (plan?.estimatedTravelCost ?? 0) || undefined;

  const spendNum = parseMoney(actualSpend);
  const spendVal = typeof spendNum === "number" ? spendNum : undefined;
  const delta =
    plannedTotal != null && spendVal != null ? spendVal - plannedTotal : undefined;
  const leadsNum = parseCount(leads);
  const leadsVal = typeof leadsNum === "number" ? leadsNum : undefined;
  const costPerLead =
    spendVal != null && leadsVal != null && leadsVal > 0
      ? spendVal / leadsVal
      : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Event debrief</p>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{eventName}</h1>
      </header>

      {/* Where the numbers come from — the citation rule, made visible. */}
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          Planned figures are sourced from the event; travel is a labeled estimate. The results you
          enter are your own numbers — kept private to your account.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* PLANNED (sourced) */}
        <Card className="rounded-xl border-zinc-200 shadow-none dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Planned
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                Registration
              </div>
              {cited ? (
                <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {usd(plan!.registrationCost!)}
                  <a
                    href={plan!.registrationCostSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs font-normal text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400"
                  >
                    source <ExternalLink className="size-3" />
                  </a>
                  {verified && (
                    <span className="text-xs font-normal text-zinc-400">verified {verified}</span>
                  )}
                </span>
              ) : (
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  cost unverified
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                Travel
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold normal-case text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  estimate
                </span>
              </div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {plan?.estimatedTravelCost != null ? usd(plan.estimatedTravelCost) : "not estimated"}
              </span>
            </div>

            {plannedTotal != null && (
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                  Planned total
                </div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {usd(plannedTotal)}
                </span>
                <span className="ml-1 text-xs text-zinc-400">(travel estimated)</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ACTUAL (your own numbers) */}
        <Card className="rounded-xl border-zinc-200 shadow-none dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                Outcome
              </div>
              <div className="flex gap-2">
                {(["attended", "skipped"] as const).map((o) => (
                  <Button
                    key={o}
                    type="button"
                    size="sm"
                    variant={outcome === o ? "default" : "outline"}
                    onClick={() => setOutcome((cur) => (cur === o ? undefined : o))}
                  >
                    {o === "attended" ? "Attended" : "Skipped"}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="actual-spend" className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                Actual spend (USD)
              </label>
              <Input
                id="actual-spend"
                inputMode="decimal"
                placeholder="0"
                value={actualSpend}
                onChange={(e) => setActualSpend(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leads" className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                  Leads gained
                </label>
                <Input
                  id="leads"
                  inputMode="numeric"
                  placeholder="0"
                  value={leads}
                  onChange={(e) => setLeads(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="contacts" className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                  Contacts gained
                </label>
                <Input
                  id="contacts"
                  inputMode="numeric"
                  placeholder="0"
                  value={contacts}
                  onChange={(e) => setContacts(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
                Worth it?
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={worthIt === n ? "default" : "outline"}
                    className="w-9 px-0"
                    onClick={() => setWorthIt((cur) => (cur === n ? undefined : n))}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Planned-vs-actual takeaway — the "justify the spend" line. */}
      {(delta != null || costPerLead != null) && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {delta != null && (
            <span>
              You spent {usd(spendVal!)} against a {usd(plannedTotal!)} plan —{" "}
              <span
                className={
                  delta > 0
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "font-semibold text-emerald-700 dark:text-emerald-400"
                }
              >
                {usd(Math.abs(delta))} {delta > 0 ? "over" : delta < 0 ? "under" : "on"} plan
              </span>
              .
            </span>
          )}
          {costPerLead != null && (
            <span className="ml-1">
              That&apos;s <span className="font-semibold">{usd(costPerLead)}</span> per lead.
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <label htmlFor="notes" className="text-[0.7rem] font-medium uppercase tracking-wide text-zinc-400">
          Notes
        </label>
        <Textarea
          id="notes"
          placeholder="What worked, who you met, whether you'd go again…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1"
        />
      </div>

      {/* Save */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {debriefId ? "Save changes" : "Save debrief"}
        </Button>
        {saved && !saving && (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</span>
        )}
        {debriefId && !saved && <Badge variant="secondary">Debrief saved</Badge>}
        {saveError && <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>}
      </div>
    </div>
  );
}
