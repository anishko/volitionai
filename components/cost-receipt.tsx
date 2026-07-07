// The receipt — "This briefing cost $0.04". The Bastiat beat: unseen costs made
// seen. Rolls per-stage CostEvents into a readable breakdown.
import type { CostReceipt, PipelineStage, CostProvider } from "@/types/cost";

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  plan: "Plan",
  extract_profile: "Profile",
  extract_voice: "Voice",
  search: "Search",
  scrape: "Scrape",
  rank: "Rank",
  synthesize: "Synthesize",
  draft: "Draft",
  event_search: "Event search",
  event_scrape: "Event scrape",
  event_match: "Event match",
  donor_signal: "Donor signal",
};

export function CostReceiptCard({
  receipt,
  cachedAt,
}: {
  receipt: CostReceipt;
  cachedAt?: string;
}) {
  // Group byStage entries into { stage, provider, usd } rollups.
  const rows = new Map<string, { stage: PipelineStage; provider: CostProvider; usd: number }>();
  for (const e of receipt.byStage) {
    const key = `${e.stage}:${e.provider}`;
    const cur = rows.get(key);
    if (cur) cur.usd += e.usd;
    else rows.set(key, { stage: e.stage, provider: e.provider, usd: e.usd });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          This briefing cost
        </span>
        <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {fmtUsd(receipt.totalUsd)}
        </span>
      </div>

      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {receipt.localTokenShare}% of tokens ran locally at $0
        {cachedAt ? ` · cached run from ${new Date(cachedAt).toLocaleString()}` : ""}
      </div>

      <dl className="mt-4 space-y-1.5">
        {[...rows.values()].map((r) => (
          <div
            key={`${r.stage}:${r.provider}`}
            className="flex items-center justify-between text-sm"
          >
            <dt className="text-zinc-600 dark:text-zinc-300">
              {STAGE_LABEL[r.stage] ?? r.stage}{" "}
              <span className="text-zinc-400 dark:text-zinc-500">· {r.provider}</span>
            </dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
              {fmtUsd(r.usd)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
