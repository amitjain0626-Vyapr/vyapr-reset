// @ts-nocheck
// app/api/roi/proof/route.ts
// Builds a WhatsApp-forwardable ROI proof text for a provider.
// No schema changes. Reads existing debug/events + providers endpoints.
//
// Usage:
//   /api/roi/proof?slug=amitjain0626&window=7d
//
// Returns:
// {
//   ok: true,
//   slug: "amitjain0626",
//   windowDays: 7,
//   metrics: { leads: 0, bookings: 0, paid_count: 0, paid_sum: 0 },
//   text: "…",
//   wa: { url: "https://api.whatsapp.com/send?text=..." }
// }

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseWindow(q: string | null): number {
  const s = (q || "").trim().toLowerCase();
  if (!s) return 7;
  const m = s.match(/^(\d+)([dwm])$/);
  if (!m) return 7;
  const n = parseInt(m[1]!, 10);
  const unit = m[2];
  if (unit === "d") return Math.max(1, n);
  if (unit === "w") return Math.max(1, n * 7);
  if (unit === "m") return Math.max(1, n * 30);
  return 7;
}

function inr(n: number): string {
  // Format like ₹12,34,567
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      Math.round(n || 0)
    );
  } catch {
    return String(Math.round(n || 0));
  }
}

async function getJSON(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url} -> ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "";
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing slug" },
        { status: 400 }
      );
    }
    const windowDays = parseWindow(searchParams.get("window"));
    const now = Date.now();
    const sinceMs = now - windowDays * 24 * 60 * 60 * 1000;

    // Base URL (prefer env, fallback to request origin)
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // 1) Resolve provider (id + display_name)
    let providerId: string | null = null;
    let providerName: string = slug;
    try {
      const p = await getJSON(`${base}/api/providers/${slug}`);
      // Expect shape: { ok: true, provider: { id, display_name, ... } }
      const prov = p?.provider || p; // be tolerant
      providerId = prov?.id || null;
      providerName = prov?.display_name || slug;
    } catch {
      // Safe fallback: use slug only
    }

    // Helper to fetch a single event type from debug endpoint
    async function fetchEvents(evt: string) {
      // We’ll pull a generous window and filter in code
      const j = await getJSON(
        `${base}/api/debug/events?event=${encodeURIComponent(
          evt
        )}&limit=1000`
      );
      return Array.isArray(j?.rows) ? j.rows : [];
    }

    // 2) Pull events we need and filter
    const [leadCreated, leadImported, bookingConfirmed, paymentSuccess] =
      await Promise.all([
        fetchEvents("lead.created"),
        fetchEvents("lead.imported"),
        fetchEvents("booking.confirmed"),
        fetchEvents("payment.success"),
      ]);

    function keep(e: any) {
      const t = Number(e?.ts || 0);
      if (!Number.isFinite(t) || t < sinceMs) return false;
      if (providerId) return e?.provider_id === providerId;
      // Fallback match by slug if provider_id absent
      const src = e?.source;
      return src?.provider_slug === slug || src?.slug === slug;
    }

    const leadsRows = [...leadCreated, ...leadImported].filter(keep);
    const bookingsRows = bookingConfirmed.filter(keep);
    const paymentsRows = paymentSuccess.filter(keep);

    const leads = leadsRows.length;
    const bookings = bookingsRows.length;
    const paid_count = paymentsRows.length;
    const paid_sum = paymentsRows.reduce((acc: number, r: any) => {
      const amtRaw =
        r?.source?.amount ??
        r?.source?.am ??
        r?.source?.payment_amount ??
        r?.source?.₹ ??
        0;
      const n = typeof amtRaw === "string" ? parseFloat(amtRaw) : Number(amtRaw);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    const convPct =
      leads > 0 ? Math.round(((paid_count || 0) / leads) * 100) : 0;

    const bookLink = `${base}/book/${slug}`;
    const headline = `Vyapr ROI (last ${windowDays} day${
      windowDays > 1 ? "s" : ""
    })`;
    const body = `${providerName}: Leads ${leads} • Bookings ${bookings} • Paid ₹${inr(
      paid_sum
    )} (${convPct}% conv)`;
    const tail = `Share: ${bookLink}`;
    const text = `${headline}\n${body}\n${tail}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      text
    )}`;

    // 3) (Best-effort) telemetry for generation
    try {
      await fetch(`${base}/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          event: "roi.proof.generated",
          provider_slug: slug,
          ts: Date.now(),
          source: {
            windowDays,
            leads,
            bookings,
            paid_count,
            paid_sum,
          },
        }),
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      slug,
      windowDays,
      metrics: { leads, bookings, paid_count, paid_sum },
      text,
      wa: { url: waUrl },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
