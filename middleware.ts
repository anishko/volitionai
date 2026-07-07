// Session refresh + auth gate for the authenticated surface only. The legacy
// Volition demo (/ and its API routes) is deliberately outside the matcher so
// it keeps working on deployments without Supabase env vars.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const PROTECTED_PREFIXES = ["/onboarding", "/events"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the session cookie when expired; required by @supabase/ssr.
  // Degrade to unauthenticated on ANY error (misconfigured/unreachable Supabase,
  // edge fetch failure) rather than 500 the whole route — a broken auth backend
  // must not take down /login, /onboarding, and /events with a server error.
  // NOTE for auth PR owner: added after prod returned 500 on all auth routes
  // when Supabase env was set-but-broken; treat this as the intended failure mode.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error(
      "[middleware] supabase.auth.getUser failed; treating request as unauthenticated:",
      err,
    );
    user = null;
  }

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = LOGIN_PATH;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ["/login", "/onboarding/:path*", "/events/:path*", "/auth/:path*"],
};
