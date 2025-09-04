// app/api/google-calendar/token/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    // HttpOnly cookie so server routes can read it (fallback when session doesn't expose provider_token)
    res.cookies.set("gc_at", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // best-effort telemetry
    fetch(`${req.nextUrl.origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "calendar.token.saved", source: { via: "auth.finish" } }),
    }).catch(() => {});

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "save_failed" }, { status: 500 });
  }
}
