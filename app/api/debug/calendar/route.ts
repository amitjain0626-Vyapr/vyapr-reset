// app/api/debug/calendar/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function baseUrl(req: Request) {
  const h = (n: string) => req.headers.get(n);
  const proto = h("x-forwarded-proto") || "https";
  const host = h("x-forwarded-host") || h("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = String(searchParams.get("limit") || "20");
    const limit = Math.max(1, Math.min(parseInt(limitRaw, 10) || 20, 100));

    const base = baseUrl(req);
    // We read last calendar sync events from Events via the existing debug feed.
    // If none yet, this returns an empty list (no schema drift).
    const url = `${base}/api/debug/events?event=calendar.booking.synced&limit=${limit}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const rows = Array.isArray(j?.rows) ? j.rows : [];

    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed" },
      { status: 500 }
    );
  }
}
