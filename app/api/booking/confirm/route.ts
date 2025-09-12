// app/api/booking/confirm/route.ts
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
 * 22.22 — Booking Spine: Confirm (stub)
 * No schema drift. No DB writes.
 * Telemetry strict: {event, ts, provider_id, lead_id, source}
 * Event: "booking.confirmed"
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim();
  const slot = String(body?.slot || "").trim();
  const via = String(body?.via || "api");
  const lead_id = typeof body?.lead_id === "string" ? body.lead_id : null;

  if (!slug || !slot) {
    return NextResponse.json({ ok: false, error: "missing_slug_or_slot" }, { status: 400 });
  }
  const t = Date.parse(slot);
  if (!Number.isFinite(t)) {
    return NextResponse.json({ ok: false, error: "invalid_slot" }, { status: 400 });
  }

  // Base URL (Vercel-safe)
  const baseUrl = resolveBaseUrl(req);

  // Provider (best-effort; keep nulls if not resolvable)
  const provider = await resolveProvider(baseUrl, slug);
  const provider_id = provider?.id || null;

  // Telemetry — booking.confirmed (existing behavior)
  try {
    const u = new URL("/api/events/log", baseUrl);
    u.searchParams.set("slug", slug);
    await fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        event: "booking.confirmed",
        ts: Date.now(),
        provider_id,
        lead_id,
        source: { slug, slot, via },
      }),
    }).catch(() => {});
  } catch { /* ignore */ }

  /* === INSERT (22.23): Auto-verify on booking → contact.verified.auto === */
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
        source: { via: "booking.confirm", slug, slot, reason: "booking_confirmed" },
      }),
    }).catch(() => {});
  } catch { /* non-blocking */ }
  /* === INSERT END === */

  return NextResponse.json({ ok: true, confirmed: true, slug, slot });
}
