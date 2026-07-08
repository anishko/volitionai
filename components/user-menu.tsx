import Image from "next/image";
import { SignOutButton } from "@/components/sign-out-button";
import type { User } from "@supabase/supabase-js";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function UserMenu({ user }: { user: User }) {
  const name: string =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Account";
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;
  const displayName = name.includes("@") ? name.split("@")[0] : name;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            {initials(name)}
          </div>
        )}
        <span className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:block">
          {displayName}
        </span>
      </div>
      <SignOutButton />
    </div>
  );
}
