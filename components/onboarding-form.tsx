"use client";

// The 8-field onboarding form (issue #3). Selection inputs are chip toggles —
// same idiom as the demo-persona chips on the home page — with native
// semantics preserved via role/aria attributes.
import { useState } from "react";
import { useRouter } from "next/navigation";
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

const CHIP_BASE =
  "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50";
const CHIP_OFF =
  "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";
const CHIP_ON =
  "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  multi,
  disabled,
  label,
}: {
  options: readonly { value: V; label: string }[];
  value: V[];
  onChange: (next: V[]) => void;
  multi: boolean;
  disabled?: boolean;
  label: string;
}) {
  function toggle(v: V) {
    if (!multi) return onChange([v]);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={`${CHIP_BASE} ${selected ? CHIP_ON : CHIP_OFF}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        {hint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [causeAreas, setCauseAreas] = useState<string[]>([]);
  const [geographyFocus, setGeographyFocus] = useState<string[]>([]);
  const [geographyDetail, setGeographyDetail] = useState("");
  const [orgSize, setOrgSize] = useState<string[]>([]);
  const [currentDonorMix, setCurrentDonorMix] = useState<string[]>([]);
  const [targetDonorType, setTargetDonorType] = useState<string[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<string[]>([]);
  const [openEndedNotes, setOpenEndedNotes] = useState("");
  const [causeSubTags, setCauseSubTags] = useState<string[]>([]);
  const [annualBudgetCap, setAnnualBudgetCap] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = OnboardingFormSchema.safeParse({
      orgName,
      website,
      causeAreas,
      geographyFocus: geographyFocus[0],
      geographyDetail: geographyDetail || undefined,
      orgSize: orgSize[0],
      currentDonorMix,
      targetDonorType,
      primaryGoal: primaryGoal[0],
      openEndedNotes: openEndedNotes || undefined,
      causeSubTags: causeAreas.includes("civil_liberties") ? causeSubTags : [],
      annualBudgetCap: annualBudgetCap ? Number(annualBudgetCap) : undefined,
      budgetPeriod: budgetPeriod || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/nonprofit/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (res.status === 409) {
        router.push("/events");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to save profile");
      router.push("/events");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
      <Field label="Org name and website">
        <div className="space-y-2">
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            disabled={submitting}
            aria-label="Organization name"
          />
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://your-org.org (optional)"
            disabled={submitting}
            aria-label="Website"
            inputMode="url"
          />
        </div>
      </Field>

      <Field label="Cause area" hint="Pick everything that fits.">
        <ChipGroup
          label="Cause area"
          options={CAUSE_AREAS}
          value={causeAreas}
          onChange={setCauseAreas}
          multi
          disabled={submitting}
        />
      </Field>

      {causeAreas.includes("civil_liberties") && (
        <Field label="Civil-liberties focus" hint="We match on these sub-tags.">
          <ChipGroup
            label="Civil-liberties focus"
            options={CAUSE_SUB_TAGS}
            value={causeSubTags}
            onChange={setCauseSubTags}
            multi
            disabled={submitting}
          />
        </Field>
      )}

      <Field label="Geographic focus">
        <div className="space-y-2">
          <ChipGroup
            label="Geographic focus"
            options={GEOGRAPHY_FOCUS}
            value={geographyFocus}
            onChange={setGeographyFocus}
            multi={false}
            disabled={submitting}
          />
          <Input
            value={geographyDetail}
            onChange={(e) => setGeographyDetail(e.target.value)}
            placeholder="City or region, e.g. “Little Rock, AR” (optional)"
            disabled={submitting}
            aria-label="City or region"
          />
        </div>
      </Field>

      <Field label="Org size" hint="Annual budget.">
        <ChipGroup
          label="Org size"
          options={ORG_SIZES}
          value={orgSize}
          onChange={setOrgSize}
          multi={false}
          disabled={submitting}
        />
      </Field>

      <Field
        label="Annual conference budget (optional)"
        hint="Powers budget-capped annual planning."
      >
        <div className="flex gap-2">
          <Input
            value={annualBudgetCap}
            onChange={(e) => setAnnualBudgetCap(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Cap ($)"
            disabled={submitting}
            inputMode="numeric"
            aria-label="Annual budget cap"
          />
          <Input
            value={budgetPeriod}
            onChange={(e) => setBudgetPeriod(e.target.value)}
            placeholder='Period (e.g. "2027")'
            disabled={submitting}
            aria-label="Budget period"
          />
        </div>
      </Field>

      <Field label="Current donor mix" hint="Who funds you today?">
        <ChipGroup
          label="Current donor mix"
          options={DONOR_TYPES}
          value={currentDonorMix}
          onChange={setCurrentDonorMix}
          multi
          disabled={submitting}
        />
      </Field>

      <Field label="Target donor type" hint="Who do you want more of?">
        <ChipGroup
          label="Target donor type"
          options={DONOR_TYPES}
          value={targetDonorType}
          onChange={setTargetDonorType}
          multi
          disabled={submitting}
        />
      </Field>

      <Field label="Primary goal">
        <ChipGroup
          label="Primary goal"
          options={PRIMARY_GOALS}
          value={primaryGoal}
          onChange={setPrimaryGoal}
          multi={false}
          disabled={submitting}
        />
      </Field>

      <Field label="Anything else we should know?">
        <Textarea
          value={openEndedNotes}
          onChange={(e) => setOpenEndedNotes(e.target.value)}
          placeholder="Campaigns you run, moments that matter to you, donors you dream about…"
          className="min-h-24"
          disabled={submitting}
        />
      </Field>

      <div className="space-y-2">
        <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
          {submitting ? "Building your profile locally…" : "Build my profile"}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          Profile extraction runs on a local model. Your answers become a
          structured profile; we don’t train on them.
        </p>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
