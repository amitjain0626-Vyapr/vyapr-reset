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
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "5", 10);
  const base = baseUrl(req);
  const r = await fetch(`${base}/api/debug/events?event=calendar.booking.synced&limit=${limit}`);
  const j = await r.json();
  return NextResponse.json(j);
}
