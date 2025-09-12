// app/api/payments/create/route.ts
// @ts-nocheck

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 22.22 — Payments: UPI test stub
 * No schema drift. No DB writes.
 * Telemetry: {event, ts, provider_id, lead_id, source}
 * Event: "payment.success"
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  const amount = Number(body?.amount);
  const currency = String(body?.currency || "INR").toUpperCase();
  const upi = String(body?.upi || "amit.jain0626@okaxis").trim();
  const via = String(body?.via || "api");

  if (!slug || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "missing_or_invalid_params" }, { status: 400 });
  }

  // Vercel-safe base URL
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const baseUrl = (xfProto && xfHost)
    ? `${xfProto}://${xfHost}`
    : (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin);

  // Telemetry — payment.success
  try {
    const u = new URL("/api/events/log", baseUrl);
    u.searchParams.set("slug", slug);
    await fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        event: "payment.success",
        ts: Date.now(),
        provider_id: null,
        lead_id: null,
        source: { slug, amount, currency, method: "upi", upi_id: upi, via },
      }),
    }).catch(() => {});
  } catch {
    // non-blocking
  }

  return NextResponse.json({ ok: true, simulated: true, slug, amount, currency, upi });
}
