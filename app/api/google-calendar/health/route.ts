// app/api/google-calendar/health/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Purpose: Verify that the current provider has a valid Google Calendar token.
 * What it checks (in order):
 * 1) Secure cookie 'gc_at' set by /api/google-calendar/token (best for server).
 * 2) Supabase session's provider_token/provider_access_token (fallback).
 * Then calls CalendarList to confirm access.
 */
export async function GET(req: NextRequest) {
  const cookieStore = cookies();

  // 0) Cookie fallback FIRST (so we don't require session exposure of provider_token)
  const cookieTok = cookieStore.get("gc_at")?.value || null;

  // 1) Try Supabase session as secondary source
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

  const { data: sessData } = await supabase.auth.getSession();
  const session: any = sessData?.session || null;

  const providerToken =
    cookieTok ||
    session?.provider_token ||
    session?.provider_access_token ||
    null;

  if (!providerToken) {
    await logEvent(req, "calendar.health.no_token", { where: "health" });
    return NextResponse.json(
      { ok: false, error: "no_google_token" },
      { status: 400 }
    );
  }

  // 2) Call Google Calendar (lightweight list)
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

    return NextResponse.json({ ok: true, primary });
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
