// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * Handles Supabase magic-link redirect:
 *  - Exchanges `code` for a session using the FULL URL (required in newer helpers)
 *  - Confirms user is set
 *  - Redirects to ?next=... (default: /onboarding)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/onboarding";

  const supabase = createRouteHandlerClient({ cookies });

  // IMPORTANT: pass the full URL, not just the code
  const { error } = await supabase.auth.exchangeCodeForSession(url.toString());
  if (error) {
    const fail = new URL(url.origin + "/login");
    fail.searchParams.set("reason", "auth_exchange_failed");
    return NextResponse.redirect(fail, { status: 302 });
  }

  // Verify session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const fail = new URL(url.origin + "/login");
    fail.searchParams.set("reason", "no_user_after_exchange");
    return NextResponse.redirect(fail, { status: 302 });
  }

  return NextResponse.redirect(new URL(next, url.origin), { status: 302 });
}
