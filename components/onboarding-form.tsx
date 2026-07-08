"use client";

// The 8-field onboarding form (issue #3). Selection inputs are chip toggles —
// same idiom as the demo-persona chips on the home page — with native
// semantics preserved via role/aria attributes.
// Pass `mode="edit"` with `initialValues` and `onSuccess` to wire it to
// PATCH /api/nonprofit/profile instead of POST (used by /profile, issue #10).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CAUSE_AREAS,
  CAUSE_SUB_TAGS,
  ORG_SIZES,
  DONOR_TYPES,
  PRIMARY_GOALS,
  OnboardingFormSchema,
  type OnboardingForm,
} from "@/lib/nonprofit/onboarding-schema";
import { UsCityPicker, UsCitiesMultiPicker } from "@/components/us-city-picker";
import { RegionMultiPicker } from "@/components/region-multi-picker";

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

type Props =
  | { mode?: "create"; initialValues?: undefined; onSuccess?: undefined }
  | { mode: "edit"; initialValues: Partial<OnboardingForm>; onSuccess: () => void };

export function OnboardingForm({ mode = "create", initialValues, onSuccess }: Props) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(initialValues?.orgName ?? "");
  const [website, setWebsite] = useState(initialValues?.website ?? "");
  const [causeAreas, setCauseAreas] = useState<string[]>(initialValues?.causeAreas ?? []);
  const [headquarters, setHeadquarters] = useState(initialValues?.headquarters ?? "");
  const [citiesOfInterest, setCitiesOfInterest] = useState<string[]>(
    initialValues?.citiesOfInterest ?? [],
  );
  const [regionsOfInterest, setRegionsOfInterest] = useState<string[]>(
    initialValues?.regionsOfInterest ?? [],
  );
  const [orgSize, setOrgSize] = useState<string[]>(
    initialValues?.orgSize ? [initialValues.orgSize] : [],
  );
  const [currentDonorMix, setCurrentDonorMix] = useState<string[]>(
    initialValues?.currentDonorMix ?? [],
  );
  const [targetDonorType, setTargetDonorType] = useState<string[]>(
    initialValues?.targetDonorType ?? [],
  );
  const [primaryGoal, setPrimaryGoal] = useState<string[]>(
    initialValues?.primaryGoal ? [initialValues.primaryGoal] : [],
  );
  const [openEndedNotes, setOpenEndedNotes] = useState(initialValues?.openEndedNotes ?? "");
  const [causeSubTags, setCauseSubTags] = useState<string[]>(initialValues?.causeSubTags ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const parsed = OnboardingFormSchema.safeParse({
      orgName,
      website,
      causeAreas,
      geographyFocus: "national",
      headquarters: headquarters || undefined,
      citiesOfInterest,
      regionsOfInterest,
      orgSize: orgSize[0],
      currentDonorMix,
      targetDonorType,
      primaryGoal: primaryGoal[0],
      openEndedNotes: openEndedNotes || undefined,
      causeSubTags: causeAreas.includes("civil_liberties") ? causeSubTags : [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the form.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "edit") {
        const res = await fetch("/api/nonprofit/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to update profile");
        onSuccess?.();
      } else {
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
        const notice = data.floorError
          ? "seed-failed"
          : data.floorMatches === 0
            ? "seed-empty"
            : null;
        router.push(notice ? `/events?notice=${notice}` : "/events");
      }
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

      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Headquarters</p>
          <UsCityPicker
            value={headquarters}
            onChange={setHeadquarters}
            disabled={submitting}
            aria-label="Headquarters"
          />
        </div>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Field label="Geographic interests">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Cities</p>
                <UsCitiesMultiPicker
                  value={citiesOfInterest}
                  onChange={setCitiesOfInterest}
                  disabled={submitting}
                  aria-label="Cities"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Regions</p>
                <RegionMultiPicker
                  value={regionsOfInterest}
                  onChange={setRegionsOfInterest}
                  disabled={submitting}
                />
              </div>
            </div>
          </Field>
        </div>
      </div>

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
          {submitting
            ? mode === "edit"
              ? "Updating profile locally…"
              : "Building your profile locally…"
            : mode === "edit"
              ? "Save changes"
              : "Build my profile"}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          Profile extraction runs on a local model. Your answers become a
          structured profile; we don't train on them.
        </p>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
