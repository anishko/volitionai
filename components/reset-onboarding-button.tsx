"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ResetOnboardingButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirming" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/nonprofit/profile", { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "Failed to reset. Please try again.");
        setState("idle");
        return;
      }
      // Clear any cached match flags so the events page re-runs on next visit.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("volition:")) localStorage.removeItem(key);
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setState("loading");
    }
  }

  if (state === "confirming") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This deletes your profile, events, and plan. Are you sure?
        </p>
        <Button variant="destructive" size="sm" onClick={reset}>
          Yes, restart
        </Button>
        <Button variant="outline" size="sm" onClick={() => setState("idle")}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={state === "loading"}
        onClick={() => setState("confirming")}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {state === "loading" ? "Resetting…" : "Restart onboarding"}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
