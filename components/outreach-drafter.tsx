"use client";

// /outreach/[matchId] — "prep the send." Three draft-type tabs, each generated
// LOCALLY via POST /api/outreach and grounded in the match's cited claims.
// The org copies or downloads a .eml and sends it themselves — we never send.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CostReceiptCard } from "@/components/cost-receipt";
import type { CostReceipt } from "@/types/cost";
import type { OutreachDraft, OutreachDraftType } from "@/types";

const TYPES: { value: OutreachDraftType; label: string; blurb: string }[] = [
  { value: "sponsor_pitch", label: "Sponsor pitch", blurb: "Email to the event's sponsorship lead." },
  { value: "cfp_abstract", label: "Speaking (CFP)", blurb: "A session proposal shaped to the event's themes." },
  { value: "intro_email", label: "Intro email", blurb: "A meeting request to a relevant funder / program officer." },
];

interface DraftState {
  draft?: OutreachDraft;
  receipt?: CostReceipt;
  loading: boolean;
  error?: string;
}

/** Split a "Subject: …" first line off the body, if present. */
function splitSubject(body: string): { subject: string; content: string } {
  const nl = body.indexOf("\n");
  const first = (nl === -1 ? body : body.slice(0, nl)).trim();
  if (/^subject:/i.test(first)) {
    return { subject: first.replace(/^subject:\s*/i, ""), content: body.slice(nl + 1).trim() };
  }
  return { subject: "Outreach draft", content: body };
}

function downloadEml(fileBase: string, body: string) {
  const { subject, content } = splitSubject(body);
  // X-Unsent:1 makes Outlook/Apple Mail open this as an editable, unsent draft.
  const eml = `X-Unsent: 1\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${content}\n`;
  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function OutreachDrafter({
  matchId,
  eventName,
}: {
  matchId: string;
  eventName: string;
}) {
  const [active, setActive] = useState<OutreachDraftType>("sponsor_pitch");
  const [states, setStates] = useState<Record<OutreachDraftType, DraftState>>({
    sponsor_pitch: { loading: false },
    cfp_abstract: { loading: false },
    intro_email: { loading: false },
  });
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async (draftType: OutreachDraftType) => {
    setStates((s) => ({ ...s, [draftType]: { ...s[draftType], loading: true, error: undefined } }));
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, draftType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Draft failed.");
      setStates((s) => ({
        ...s,
        [draftType]: { loading: false, draft: json.draft as OutreachDraft, receipt: json.receipt as CostReceipt },
      }));
    } catch (err) {
      setStates((s) => ({
        ...s,
        [draftType]: { loading: false, error: err instanceof Error ? err.message : "Draft failed." },
      }));
    }
  }, [matchId]);

  // Lazily generate a tab's draft the first time it becomes active.
  useEffect(() => {
    const st = states[active];
    if (!st.draft && !st.loading && !st.error) void generate(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const st = states[active];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Draft outreach</p>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{eventName}</h1>
      </header>

      {/* The trust note — the whole point of "prep the send". */}
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <ShieldCheck className="size-4 shrink-0" />
        <span>You send it — we never do. These drafts are prepared locally in your voice; nothing leaves your account.</span>
      </div>

      <Tabs value={active} onValueChange={(v) => { setActive(v as OutreachDraftType); setCopied(false); }}>
        <TabsList className="w-full">
          {TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">{t.blurb}</p>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              {st.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : st.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{st.error}</p>
              ) : st.draft ? (
                <pre className="font-sans text-sm whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-100">
                  {st.draft.body}
                </pre>
              ) : null}
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={st.loading}
                onClick={() => { setCopied(false); void generate(t.value); }}
              >
                {st.loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!st.draft}
                onClick={async () => {
                  if (!st.draft) return;
                  await navigator.clipboard.writeText(st.draft.body);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!st.draft}
                onClick={() => st.draft && downloadEml(`${t.value}-${matchId.slice(0, 8)}`, st.draft.body)}
              >
                <Download className="size-4" />
                Download .eml
              </Button>
              {st.draft?.modelRoute === "fallback:cloud" && (
                <span className="text-xs text-amber-600 dark:text-amber-400">drafted on cloud fallback</span>
              )}
            </div>

            {/* Evidence the draft drew on — citation or no signal. */}
            {st.draft && st.draft.evidence.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Evidence this draft drew on
                </p>
                <ul className="space-y-2">
                  {st.draft.evidence.map((e, i) => (
                    <li key={i} className="text-sm text-zinc-600 dark:text-zinc-300">
                      <span>{e.claim}</span>{" "}
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
                      >
                        source
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {st.receipt && (
              <div className="mt-5">
                <CostReceiptCard receipt={st.receipt} />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
