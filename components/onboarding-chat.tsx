"use client";

// Conversational onboarding (PRD v4). A local-model chat builds the profile
// incrementally; a live panel fills in beside it; uploads are one dropzone
// (classified locally); the user confirms an editable review before save.
// Falls back to /onboarding/form. AI replaces the keyboard, not the judgment.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CAUSE_AREAS,
  CAUSE_SUB_TAGS,
  GEOGRAPHY_FOCUS,
  ORG_SIZES,
  DONOR_TYPES,
  PRIMARY_GOALS,
  OnboardingFormSchema,
} from "@/lib/nonprofit/onboarding-schema";

type Msg = { role: "user" | "assistant"; content: string };
type Draft = {
  orgName?: string;
  website?: string;
  causeAreas: string[];
  causeSubTags: string[];
  geographyFocus?: string;
  geographyDetail?: string;
  orgSize?: string;
  currentDonorMix: string[];
  targetDonorType: string[];
  primaryGoal?: string;
  annualBudgetCap?: number;
  budgetPeriod?: string;
  openEndedNotes?: string;
};
type Upload = { name: string; classification: string; facts: string };

const emptyDraft: Draft = { causeAreas: [], causeSubTags: [], currentDonorMix: [], targetDonorType: [] };

const vals = (a: readonly { value: string }[]) => a.map((o) => o.value);
const keepKnown = (input: unknown, allowed: string[]): string[] =>
  Array.isArray(input) ? input.map(String).filter((v) => allowed.includes(v)) : [];
const firstKnown = (input: unknown, allowed: string[]): string | undefined =>
  typeof input === "string" && allowed.includes(input) ? input : undefined;

function mergeForm(draft: Draft, form: Record<string, unknown>): Draft {
  return {
    orgName: typeof form.orgName === "string" ? form.orgName : draft.orgName,
    website: typeof form.website === "string" ? form.website : draft.website,
    causeAreas: form.causeAreas ? keepKnown(form.causeAreas, vals(CAUSE_AREAS)) : draft.causeAreas,
    causeSubTags: form.causeSubTags ? keepKnown(form.causeSubTags, vals(CAUSE_SUB_TAGS)) : draft.causeSubTags,
    geographyFocus: firstKnown(form.geographyFocus, vals(GEOGRAPHY_FOCUS)) ?? draft.geographyFocus,
    geographyDetail: typeof form.geographyDetail === "string" ? form.geographyDetail : draft.geographyDetail,
    orgSize: firstKnown(form.orgSize, vals(ORG_SIZES)) ?? draft.orgSize,
    currentDonorMix: form.currentDonorMix ? keepKnown(form.currentDonorMix, vals(DONOR_TYPES)) : draft.currentDonorMix,
    targetDonorType: form.targetDonorType ? keepKnown(form.targetDonorType, vals(DONOR_TYPES)) : draft.targetDonorType,
    primaryGoal: firstKnown(form.primaryGoal, vals(PRIMARY_GOALS)) ?? draft.primaryGoal,
    annualBudgetCap: typeof form.annualBudgetCap === "number" ? form.annualBudgetCap : draft.annualBudgetCap,
    budgetPeriod: typeof form.budgetPeriod === "string" ? form.budgetPeriod : draft.budgetPeriod,
    openEndedNotes: typeof form.openEndedNotes === "string" ? form.openEndedNotes : draft.openEndedNotes,
  };
}

const CHIP = "rounded-full border px-3 py-1 text-xs transition-colors";
const OFF = "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300";
const ON = "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

function Chips({
  options, value, multi, onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string[];
  multi: boolean;
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" className={`${CHIP} ${on ? ON : OFF}`}
            onClick={() =>
              multi
                ? onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])
                : onChange([o.value])
            }>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [qualitative, setQualitative] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  async function turn(history: Msg[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nonprofit/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Intake failed");
      setMessages([...history, { role: "assistant", content: data.reply }]);
      setDraft((d) => mergeForm(d, data.form ?? {}));
      if (data.qualitativeSignals) setQualitative(data.qualitativeSignals);
      if (data.complete) setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Kick off the first assistant turn once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    turn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send() {
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setInput("");
    turn(next);
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const payload = [];
      for (const f of Array.from(files).slice(0, 10)) {
        const text = await f.text().catch(() => "");
        payload.push({ name: f.name, text: text.slice(0, 200_000) });
      }
      const res = await fetch("/api/nonprofit/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Classification failed");
      const results: Upload[] = data.results ?? [];
      setUploads((u) => [...u, ...results]);
      // Fold extracted facts into notes so the profile extractor uses them.
      const factLines = results
        .filter((r) => r.facts)
        .map((r) => `[upload:${r.classification}] ${r.facts}`)
        .join("\n");
      if (factLines) setDraft((d) => ({ ...d, openEndedNotes: [d.openEndedNotes, factLines].filter(Boolean).join("\n") }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(null);
    const candidate = {
      orgName: draft.orgName ?? "",
      website: draft.website || undefined,
      causeAreas: draft.causeAreas,
      geographyFocus: draft.geographyFocus,
      geographyDetail: draft.geographyDetail || undefined,
      orgSize: draft.orgSize,
      currentDonorMix: draft.currentDonorMix,
      targetDonorType: draft.targetDonorType,
      primaryGoal: draft.primaryGoal,
      openEndedNotes: draft.openEndedNotes || undefined,
      causeSubTags: draft.causeSubTags,
      annualBudgetCap: draft.annualBudgetCap,
      budgetPeriod: draft.budgetPeriod || undefined,
      qualitativeSignals: qualitative || undefined,
    };
    const parsed = OnboardingFormSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/nonprofit/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (res.status === 409) return router.push("/events");
      if (!res.ok) throw new Error(data?.error ?? "Failed to save profile");
      router.push("/events");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  const showSubTags = draft.causeAreas.includes("civil_liberties");

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      {/* Chat / review column */}
      <div className="order-2 md:order-1">
        {!reviewing ? (
          <div className="flex h-[28rem] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <span className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}>
                    {m.content}
                  </span>
                </div>
              ))}
              {busy && <p className="text-xs text-zinc-400">…</p>}
            </div>
            <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type your answer…"
                  disabled={busy || saving}
                />
                <Button onClick={send} disabled={busy || !input.trim()}>Send</Button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="cursor-pointer text-xs text-zinc-500 underline">
                  <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} disabled={busy} />
                  Attach files (newsletters, donor CSV, docs) — classified locally
                </label>
                {complete && (
                  <Button variant="outline" onClick={() => setReviewing(true)} className="text-sm">
                    Review &amp; save →
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Review &amp; confirm</h2>
              <button className="text-xs text-zinc-500 underline" onClick={() => setReviewing(false)}>← back to chat</button>
            </div>
            <div className="space-y-2">
              <Input value={draft.orgName ?? ""} onChange={(e) => setDraft({ ...draft, orgName: e.target.value })} placeholder="Organization name" />
              <Input value={draft.website ?? ""} onChange={(e) => setDraft({ ...draft, website: e.target.value })} placeholder="https://your-org.org (optional)" />
            </div>
            <Review label="Cause areas"><Chips options={CAUSE_AREAS} value={draft.causeAreas} multi onChange={(v) => setDraft({ ...draft, causeAreas: v })} /></Review>
            {showSubTags && (
              <Review label="Civil-liberties focus"><Chips options={CAUSE_SUB_TAGS} value={draft.causeSubTags} multi onChange={(v) => setDraft({ ...draft, causeSubTags: v })} /></Review>
            )}
            <Review label="Geographic focus"><Chips options={GEOGRAPHY_FOCUS} value={draft.geographyFocus ? [draft.geographyFocus] : []} multi={false} onChange={(v) => setDraft({ ...draft, geographyFocus: v[0] })} /></Review>
            <Review label="Org size"><Chips options={ORG_SIZES} value={draft.orgSize ? [draft.orgSize] : []} multi={false} onChange={(v) => setDraft({ ...draft, orgSize: v[0] })} /></Review>
            <Review label="Current donors"><Chips options={DONOR_TYPES} value={draft.currentDonorMix} multi onChange={(v) => setDraft({ ...draft, currentDonorMix: v })} /></Review>
            <Review label="Target donors"><Chips options={DONOR_TYPES} value={draft.targetDonorType} multi onChange={(v) => setDraft({ ...draft, targetDonorType: v })} /></Review>
            <Review label="Primary goal"><Chips options={PRIMARY_GOALS} value={draft.primaryGoal ? [draft.primaryGoal] : []} multi={false} onChange={(v) => setDraft({ ...draft, primaryGoal: v[0] })} /></Review>
            <Review label="Annual conference budget (optional)">
              <div className="flex gap-2">
                <Input inputMode="numeric" value={draft.annualBudgetCap ?? ""} onChange={(e) => setDraft({ ...draft, annualBudgetCap: e.target.value ? Number(e.target.value) : undefined })} placeholder="Cap ($)" />
                <Input value={draft.budgetPeriod ?? ""} onChange={(e) => setDraft({ ...draft, budgetPeriod: e.target.value })} placeholder='Period (e.g. "2027")' />
              </div>
            </Review>
            <Review label="Notes">
              <Textarea value={draft.openEndedNotes ?? ""} onChange={(e) => setDraft({ ...draft, openEndedNotes: e.target.value })} className="min-h-20" />
            </Review>
            {uploads.length > 0 && (
              <p className="text-xs text-zinc-500">
                Uploads: {uploads.map((u) => `${u.name} → ${u.classification}`).join(" · ")} (raw files discarded)
              </p>
            )}
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save profile & find events"}
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-center text-xs text-zinc-400">
          Prefer a form? <Link href="/onboarding/form" className="underline">Fill it out directly →</Link>
        </p>
      </div>

      {/* Live profile panel */}
      <aside className="order-1 space-y-3 md:order-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your profile</p>
          <PanelRow k="Org" v={draft.orgName} />
          <PanelRow k="Causes" v={draft.causeAreas.length ? draft.causeAreas.join(", ") : undefined} />
          {draft.causeSubTags.length > 0 && <PanelRow k="Focus" v={draft.causeSubTags.join(", ")} />}
          <PanelRow k="Geography" v={[draft.geographyFocus, draft.geographyDetail].filter(Boolean).join(" · ") || undefined} />
          <PanelRow k="Size" v={draft.orgSize} />
          <PanelRow k="Wants" v={draft.targetDonorType.length ? draft.targetDonorType.join(", ") : undefined} />
          <PanelRow k="Goal" v={draft.primaryGoal} />
          <PanelRow k="Budget" v={draft.annualBudgetCap ? `$${draft.annualBudgetCap.toLocaleString()}${draft.budgetPeriod ? ` (${draft.budgetPeriod})` : ""}` : undefined} />
        </div>
        {qualitative && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs italic text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            {qualitative}
          </div>
        )}
      </aside>
    </div>
  );
}

function Review({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
      {children}
    </div>
  );
}
function PanelRow({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-zinc-100 py-1 last:border-0 dark:border-zinc-900">
      <span className="text-zinc-400">{k}</span>
      <span className="text-right text-zinc-700 dark:text-zinc-200">{v || "—"}</span>
    </div>
  );
}
