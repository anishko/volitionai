// Google OAuth configuration (docs/NONPROFIT_EVENTS_PRD.md, "Auth").
//
// Sign-in uses the base identity scopes only. The Google Calendar scope is
// requested lazily, the first time the user taps "Sync to Calendar", never at
// signup (scope creep at signup kills conversion). The whole calendar
// integration can be switched off with CALENDAR_SYNC_ENABLED=false without
// touching the login flow: googleOAuthOptions() then never emits the scope.
//
// Usage with Supabase auth:
//   supabase.auth.signInWithOAuth({
//     provider: "google",
//     options: googleOAuthOptions(),                                // login
//   });
//   supabase.auth.signInWithOAuth({
//     provider: "google",
//     options: googleOAuthOptions({ requestCalendarScope: true }),  // first sync
//   });

export const GOOGLE_BASE_SCOPES = ["openid", "email", "profile"] as const;

/** Narrowest scope that can create/update calendar events for deadline sync. */
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

/**
 * Kill switch for the calendar integration. Defaults to enabled; set
 * NEXT_PUBLIC_CALENDAR_SYNC_ENABLED=false to hide/disable sync everywhere.
 */
export function calendarSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CALENDAR_SYNC_ENABLED !== "false";
}

/** Shape consumed by supabase.auth.signInWithOAuth options. */
export interface GoogleOAuthOptions {
  scopes: string;
  queryParams: Record<string, string>;
  redirectTo?: string;
}

export function googleOAuthOptions(
  opts: { requestCalendarScope?: boolean; redirectTo?: string } = {}
): GoogleOAuthOptions {
  const wantCalendar = (opts.requestCalendarScope ?? false) && calendarSyncEnabled();

  const scopes = [
    ...GOOGLE_BASE_SCOPES,
    ...(wantCalendar ? [GOOGLE_CALENDAR_SCOPE] : []),
  ].join(" ");

  const queryParams: Record<string, string> = {
    // Incremental auth: adding the calendar scope later must not drop the
    // identity scopes already granted at signup.
    include_granted_scopes: "true",
  };
  if (wantCalendar) {
    // Calendar API calls happen server-side after the OAuth redirect, so we
    // need a refresh token; Google only issues one with offline + consent.
    queryParams.access_type = "offline";
    queryParams.prompt = "consent";
  }

  return {
    scopes,
    queryParams,
    ...(opts.redirectTo ? { redirectTo: opts.redirectTo } : {}),
  };
}
