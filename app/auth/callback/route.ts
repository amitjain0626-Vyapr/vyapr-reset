// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * Debuggable auth callback.
 * - If ?debug=1 → returns JSON: { hasCode, exchanged, error, user_id, next }
 * - Otherwise → normal redirect to `next` (default /onboarding)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const next = url.searchParams.get("next") || "/onboarding";
  const debug = url.searchParams.get("debug") === "1";

  const supabase = createRouteHandlerClient({ cookies });

  let exchanged = false;
  let error: string | null = null;
  let user_id: string | null = null;

  if (!code) {
    if (debug) {
      return NextResponse.json({ hasCode: false, exchanged: false, error: "missing code", user_id, next });
    }
    url.pathname = "/login";
    return NextResponse.redirect(url, { status: 302 });
  }

  // Exchange the *code* (not the full URL) for a session.
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) {
    error = exErr.message || "exchange failed";
  } else {
    exchanged = true;
    const { data: { user } } = await supabase.auth.getUser();
    user_id = user?.id ?? null;
  }

  if (debug) {
    return NextResponse.json({ hasCode: true, exchanged, error, user_id, next });
  }

  if (!exchanged || !user_id) {
    const fail = new URL(url.origin + "/login");
    fail.searchParams.set("reason", error ? `exchange:${error}` : "no_user");
    return NextResponse.redirect(fail, { status: 302 });
  }

  return NextResponse.redirect(new URL(next, url.origin), { status: 302 });
}
