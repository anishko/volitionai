"use client";

import { useState } from "react";
import { OnboardingForm } from "@/components/onboarding-form";
import type { OnboardingForm as OnboardingFormValues } from "@/lib/nonprofit/onboarding-schema";

export function ProfileEditForm({ initialValues }: { initialValues: Partial<OnboardingFormValues> }) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">
          Profile updated. New recommendations will reflect these changes on your next visit to Events.
        </div>
      )}
      <OnboardingForm
        mode="edit"
        initialValues={initialValues}
        onSuccess={() => setSaved(true)}
      />
    </div>
  );
}
