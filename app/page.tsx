"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileCard } from "@/components/profile-card";
import { IdeaCardView } from "@/components/idea-card";
import { CostReceiptCard } from "@/components/cost-receipt";
import type { BusinessProfile, IdeaCard } from "@/types";
import type { CostReceipt } from "@/types/cost";
import type { RunMeta } from "@/lib/pipeline/run";

interface RunResult {
  profile: BusinessProfile;
  cards: IdeaCard[];
  receipt: CostReceipt;
  meta: RunMeta;
  cached?: boolean;
}

const PRESETS = [
  {
    slug: "crestview-trading-club",
    label: "Crestview Trading Club",
    description:
      "We're the Crestview Trading Club, a student trading and investing club at a large public university. About 40 members. We want to land sponsors, grow membership, and run a trading competition this fall.",
  },
  {
    slug: "camino-coffee",
    label: "Camino Coffee",
    description:
      "We're Camino Coffee, an independent coffee shop in Las Vegas with 12 employees. We want more foot traffic and a stronger social media presence.",
  },
];

const PHASES = [
  "Planning research queries locally…",
  "Searching the live web for evidence…",
  "Ranking evidence against your profile…",
  "Synthesizing cited idea cards…",
  "Validating citations…",
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [pastContent, setPastContent] = useState("");
  const [persona, setPersona] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cached-run fallback: ?cached=1[&persona=slug] loads a captured fixture.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("cached") === "1") {
      const p = params.get("persona") || PRESETS[0].slug;
      loadCached(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate the loading phase labels while a live run is in flight.
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 4000);
    return () => clearInterval(t);
  }, [loading]);

  async function loadCached(personaSlug: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas?cached=1&persona=${encodeURIComponent(personaSlug)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No cached run found");
      setResult({ ...data, cached: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cached run");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (description.trim().length < 10) {
      setError("Tell me a bit more about your org.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPhase(0);
    try {
      const pRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, pastContent: pastContent || undefined }),
      });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData?.error ?? "Profile extraction failed");
      const profile: BusinessProfile = pData.profile;

      const personaSlug = persona || slugify(profile.businessName || "org");
      const iRes = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, persona: personaSlug }),
      });
      const iData = await iRes.json();
      if (!iRes.ok) throw new Error(iData?.error ?? "Idea generation failed");
      setResult(iData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setDescription("");
    setPastContent("");
    setPersona(undefined);
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Volition
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            An insights team on demand — grounded, yours, and it shows you the receipt.
          </p>
        </header>

        {!result && (
          <div className="mx-auto max-w-2xl space-y-4">
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setPersona(undefined);
              }}
              placeholder="Tell me about your org. (What are you, where, who do you serve, and what do you want?)"
              className="min-h-32 text-base"
              disabled={loading}
            />
            <Input
              value={pastContent}
              onChange={(e) => setPastContent(e.target.value)}
              placeholder="Optional: paste a past post or two so we can learn your voice"
              disabled={loading}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400">Or try a demo:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setDescription(p.description);
                    setPersona(p.slug);
                  }}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? PHASES[phase] : "Generate insights"}
            </Button>

            {loading && (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            )}
            {error && <p className="text-center text-sm text-red-600">{error}</p>}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {result.cached && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Cached run
                {result.meta.capturedAt
                  ? ` from ${new Date(result.meta.capturedAt).toLocaleString()}`
                  : ""}{" "}
                — real prior pipeline output, shown as demo insurance.
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <div className="order-2 space-y-4 md:order-1">
                {result.cards.length === 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    No cards survived citation validation for this run. (That is the
                    honest outcome — Volition returns a sourced card or none at all.)
                  </div>
                )}
                {result.cards.map((card) => (
                  <IdeaCardView key={card.id} card={card} profile={result.profile} />
                ))}
              </div>

              <div className="order-1 space-y-4 md:order-2">
                <ProfileCard profile={result.profile} />
                <CostReceiptCard
                  receipt={result.receipt}
                  cachedAt={result.cached ? result.meta.capturedAt : undefined}
                />
                {result.meta.notices.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                    {result.meta.notices.map((n, i) => (
                      <p key={i}>· {n}</p>
                    ))}
                  </div>
                )}
                <Button onClick={reset} variant="outline" className="w-full">
                  Start over
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
