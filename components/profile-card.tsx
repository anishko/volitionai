// The extracted profile — shown right after onboarding. "Extracted locally, $0."
import { Badge } from "@/components/ui/badge";
import type { BusinessProfile } from "@/types";

export function ProfileCard({ profile }: { profile: BusinessProfile }) {
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {profile.businessName}
        </h2>
        <span className="text-xs text-zinc-400">extracted locally · $0</span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        {profile.orgType}
        {profile.industry ? ` · ${profile.industry}` : ""}
        {location ? ` · ${location}` : ""}
      </p>
      {profile.audience && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">Audience: </span>
          {profile.audience}
        </p>
      )}
      {profile.goals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.goals.map((g, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {g}
            </Badge>
          ))}
        </div>
      )}
      {profile.voice && (
        <p className="mt-3 text-xs italic text-zinc-500 dark:text-zinc-400">
          Voice: {profile.voice}
        </p>
      )}
    </div>
  );
}
