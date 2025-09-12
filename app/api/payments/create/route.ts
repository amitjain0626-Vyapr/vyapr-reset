// app/api/payments/create/route.ts
// @ts-nocheck

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === INSERT (22.23): helpers to resolve provider + base URL === */
function resolveBaseUrl(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  return (xfProto && xfHost)
    ? `${xfProto}://${xfHost}`
    : (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin);
}

async function resolveProvider(baseUrl: string, slug: string) {
  try {
    const u = new URL("/api/providers/resolve", baseUrl);
    u.searchParams.set("slug", slug);
    const r = await fetch(u.toString(), { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!j?.ok || !j?.id) return null;
    return j; // { ok, id, slug, ... }
  } catch { return null; }
}
/* === INSERT END === */

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
  const lead_id = typeof body?.lead_id === "string" ? body.lead_id : null;

  if (!slug || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "missing_or_invalid_params" }, { status: 400 });
  }

  // Vercel-safe base URL
  const baseUrl = resolveBaseUrl(req);

  // Provider (best-effort)
  const provider = await resolveProvider(baseUrl, slug);
  const provider_id = provider?.id || null;

  // Telemetry — payment.success (existing)
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
        provider_id,
        lead_id,
        source: { slug, amount, currency, method: "upi", upi_id: upi, via },
      }),
    }).catch(() => {});
  } catch { /* non-blocking */ }

  /* === INSERT (22.23): Auto-verify on payment → contact.verified.auto === */
  try {
    const u2 = new URL("/api/events/log", baseUrl);
    u2.searchParams.set("slug", slug);
    await fetch(u2.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        event: "contact.verified.auto",
        ts: Date.now(),
        provider_id,
        lead_id,
        source: { via: "payments.create", slug, amount, currency, reason: "payment_recorded" },
      }),
    }).catch(() => {});
  } catch { /* non-blocking */ }
  /* === INSERT END === */

  return NextResponse.json({ ok: true, simulated: true, slug, amount, currency, upi });
}
