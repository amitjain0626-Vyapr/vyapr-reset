// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * Handles Supabase magic-link redirect:
 *  - Exchanges `code` for a session
 *  - Sets auth cookies
 *  - Redirects to next=/onboarding (default) or ?next=/dashboard
 *
 * Supported:
 *  /auth/callback?code=...&next=/dashboard
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/onboarding";

  // If no code, send user to login
  if (!code) {
    url.pathname = "/login";
    return NextResponse.redirect(url, { status: 302 });
  }

  // Exchange the code for a session and set cookies
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // If exchange fails, go to login with a hint
  if (error) {
    const fail = new URL(url.origin + "/login");
    fail.searchParams.set("reason", "auth_exchange_failed");
    return NextResponse.redirect(fail, { status: 302 });
  }

  // Success → redirect
  const dest = new URL(url.origin + next);
  return NextResponse.redirect(dest, { status: 302 });
}
