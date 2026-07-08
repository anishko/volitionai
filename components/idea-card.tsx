"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessProfile, IdeaCard, IdeaLane } from "@/types";

const LANE_META: Record<IdeaLane, { label: string; className: string }> = {
  comparable: { label: "Comparable", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  opportunity: { label: "Opportunity", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  trend: { label: "Trend", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  law: { label: "Law", className: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
  event: { label: "Event", className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  donor: { label: "Donor", className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
};

export function IdeaCardView({
  card,
  profile,
}: {
  card: IdeaCard;
  profile: BusinessProfile;
}) {
  const [draft, setDraft] = useState<string | null>(card.draftContent ?? null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const lane = LANE_META[card.lane];

  async function draftIt() {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Draft failed");
      setDraft(data.draft);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lane.className}`}>
          {lane.label}
        </span>
        <Badge variant="outline" className="text-xs capitalize">
          {card.confidence} confidence
        </Badge>
      </div>

      <h3 className="text-lg leading-snug text-zinc-900 dark:text-zinc-50">
        {card.idea}
      </h3>

      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Why it fits you: </span>
        {card.whyItFitsYou}
      </p>

      {card.lane === "event" && (card.eventDates || card.eventLocation || card.sponsorCost || card.organizerContact || (card.knownPastSponsors && card.knownPastSponsors.length > 0)) && (
        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
            Event details
          </p>
          <dl className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            {card.eventDates && <div><dt className="inline font-medium">Timing: </dt><dd className="inline">{card.eventDates}</dd></div>}
            {card.eventLocation && <div><dt className="inline font-medium">Location: </dt><dd className="inline">{card.eventLocation}</dd></div>}
            {card.sponsorCost && <div><dt className="inline font-medium">Sponsor cost: </dt><dd className="inline">{card.sponsorCost}</dd></div>}
            {card.organizerContact && <div><dt className="inline font-medium">Contact: </dt><dd className="inline">{card.organizerContact}</dd></div>}
            {card.knownPastSponsors && card.knownPastSponsors.length > 0 && (
              <div><dt className="inline font-medium">Past sponsors: </dt><dd className="inline">{card.knownPastSponsors.join(", ")}</dd></div>
            )}
          </dl>
        </div>
      )}

      {card.lane === "donor" && (card.donorType || card.approachAngle) && (
        <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            Donor profile
          </p>
          <dl className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            {card.donorType && <div><dt className="inline font-medium">Type: </dt><dd className="inline capitalize">{card.donorType}</dd></div>}
            {card.approachAngle && <div><dt className="inline font-medium">Approach: </dt><dd className="inline">{card.approachAngle}</dd></div>}
          </dl>
        </div>
      )}

      {card.comparables && card.comparables.length > 0 && (
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Orgs like you
          </p>
          <ul className="space-y-2">
            {card.comparables.map((c, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-200">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                  {c.name}
                </a>
                {c.whyComparable ? ` — ${c.whyComparable}` : ""}
                {c.notablePlays.length > 0 && (
                  <span className="text-zinc-500 dark:text-zinc-400"> ({c.notablePlays.join(", ")})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Execution steps
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
          {card.executionSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Evidence
        </p>
        <ul className="space-y-1.5">
          {card.evidence.map((e, i) => (
            <li key={i} className="text-sm">
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2 dark:text-blue-400">
                {e.sourceName}
              </a>
              <span className="text-zinc-600 dark:text-zinc-300"> — {e.claim}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {draft ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Draft — in your voice, generated locally ($0)
            </p>
            <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {draft}
            </p>
          </div>
        ) : (
          <Button onClick={draftIt} disabled={drafting} variant="outline" className="text-sm">
            {drafting ? "Drafting locally…" : "Draft it — in your voice, $0"}
          </Button>
        )}
        {draftError && <p className="mt-2 text-xs text-red-600">{draftError}</p>}
      </div>
    </article>
  );
}
