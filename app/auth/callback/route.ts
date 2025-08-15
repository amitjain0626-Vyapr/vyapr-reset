// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * Debug-first callback.
 * - Always attempts: supabase.auth.exchangeCodeForSession(<full URL>)
 * - If ?debug=1, returns JSON with the exact params and outcome (no redirect)
 * - Otherwise, redirects to ?next=... or /onboarding
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/onboarding";
  const debug = url.searchParams.get("debug") === "1";

  const params = Object.fromEntries(url.searchParams.entries()); // <- see what Supabase sent

  const supabase = createRouteHandlerClient({ cookies });

  let exchanged = false;
  let error: string | null = null;
  let user_id: string | null = null;

  try {
    // IMPORTANT: pass the FULL URL so it handles both `code` and `token_hash` flows
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(url.toString());
    if (exErr) {
      error = exErr.message || "exchange failed";
    } else {
      exchanged = true;
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id ?? null;
      if (!user_id && !error) error = "no_user_after_exchange";
    }
  } catch (e: any) {
    error = e?.message || "exception during exchange";
  }

  if (debug) {
    return NextResponse.json({
      params, exchanged, error, user_id, next,
    });
  }

  if (!exchanged || !user_id) {
    const fail = new URL(url.origin + "/login");
    if (error) fail.searchParams.set("reason", error);
    return NextResponse.redirect(fail, { status: 302 });
  }

  return NextResponse.redirect(new URL(next, url.origin), { status: 302 });
}
