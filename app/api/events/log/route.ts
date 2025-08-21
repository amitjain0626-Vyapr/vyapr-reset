// app/api/events/log/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

// TEMP: console shim. If NEXT_PUBLIC_LOG=on, we log payloads server-side.
// Later we can insert into Events table with RLS-safe RPC.
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const envLog = process.env.NEXT_PUBLIC_LOG === "on";
    if (envLog) {
      // one-line, safe
      console.log("[telemetry] ", JSON.stringify(json));
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
