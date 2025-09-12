// app/api/booking/create/route.ts
// @ts-nocheck

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 22.22 — Booking Spine: Intent (stub)
 * No schema drift. No DB writes.
 * Telemetry strict: {event, ts, provider_id, lead_id, source}
 * Event: "booking.intent.clicked"
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  const slot = String(body?.slot || "").trim();
  const via = String(body?.via || "api");

  if (!slug || !slot) {
    return NextResponse.json({ ok: false, error: "missing_slug_or_slot" }, { status: 400 });
  }
  const t = Date.parse(slot);
  if (!Number.isFinite(t)) {
    return NextResponse.json({ ok: false, error: "invalid_slot" }, { status: 400 });
  }

  // Base URL for internal call
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const baseUrl = (xfProto && xfHost)
    ? `${xfProto}://${xfHost}`
    : (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin);

  // Telemetry — booking.intent.clicked
  try {
    const u = new URL("/api/events/log", baseUrl);
    u.searchParams.set("slug", slug);
    await fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        event: "booking.intent.clicked",
        ts: Date.now(),
        provider_id: null,
        lead_id: null,
        source: { slug, slot, via },
      }),
    }).catch(() => {});
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, slug, slot, telemetry_logged: true });
}
