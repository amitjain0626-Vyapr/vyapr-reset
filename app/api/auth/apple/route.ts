// app/api/auth/apple/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  // Fire-and-forget telemetry
  try {
    fetch(`${origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "auth.apple.stub",
        source: { via: "login.button", status: "unconfigured" },
      }),
    }).catch(() => {});
  } catch {}

  const target = new URL("/login", origin);
  target.searchParams.set("e", "apple_unavailable");
  return NextResponse.redirect(target.toString(), { status: 302 });
}
