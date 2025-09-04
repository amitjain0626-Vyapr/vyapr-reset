// app/api/google-calendar/health/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Purpose: Verify that the current provider has a valid Google Calendar token.
 * What it does:
 * 1) Reads Supabase session from cookies.
 * 2) Extracts provider_token (Google access token).
 * 3) Calls Google CalendarList (lightweight) to confirm access.
 * 4) Logs a telemetry event and returns a tiny JSON.
 *
 * No schema drift. Safe to call anytime.
 */
export async function GET(req: NextRequest) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 1) Get session (reads cookies)
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessData?.session) {
    return NextResponse.json(
      { ok: false, error: "no_session" },
      { status: 401 }
    );
  }

  // 2) Extract Google access token from session (supabase-js stores it as provider_token)
  const providerToken =
    (sessData.session as any)?.provider_token ||
    (sessData.session as any)?.provider_access_token ||
    null;

  if (!providerToken) {
    // Not fatal—just tells us we don't have a token in session cookies.
    // (User may need to re-login with Google after scopes update.)
    await logEvent(req, "calendar.health.no_token", {});
    return NextResponse.json(
      { ok: false, error: "no_google_token" },
      { status: 400 }
    );
  }

  // 3) Call Google Calendar (lightweight list)
  try {
    const r = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
      {
        headers: { Authorization: `Bearer ${providerToken}` },
      }
    );

    const j = await r.json().catch(() => ({}));
    const ok = r.ok === true;

    // Best-effort telemetry (non-blocking)
    await logEvent(req, ok ? "calendar.health.ok" : "calendar.health.fail", {
      status: r.status,
      kind: "calendarList",
    });

    if (!ok) {
      return NextResponse.json(
        { ok: false, status: r.status, error: j?.error || "calendar_api_failed" },
        { status: 400 }
      );
    }

    // Minimal friendly payload
    const primary =
      Array.isArray(j?.items) && j.items.length
        ? { id: j.items[0]?.id, summary: j.items[0]?.summary }
        : null;

    return NextResponse.json({
      ok: true,
      primary,
    });
  } catch (e: any) {
    await logEvent(req, "calendar.health.exception", {
      message: e?.message || "exception",
    });
    return NextResponse.json(
      { ok: false, error: "calendar_fetch_exception" },
      { status: 500 }
    );
  }
}

async function logEvent(req: NextRequest, event: string, source: any) {
  try {
    await fetch(`${req.nextUrl.origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, source }),
    });
  } catch {}
}
export {};