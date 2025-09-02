// @ts-nocheck
// app/api/cron/roi-alerts/route.ts
// Compares last 7 days vs previous 7 days for a provider.
// If ROI (₹ paid) dropped by >=10% (and previous > 0), logs roi.alert.triggered.
// No schema changes. Uses existing /api/debug/events + /api/providers/<slug>.
//
// Usage (manual run / Vercel Cron):
//   GET /api/cron/roi-alerts?slug=amitjain0626            -> run & log
//   GET /api/cron/roi-alerts?slug=amitjain0626&dry=1      -> run & log (mode: "dry")
//   (Later: without slug -> iterate all published providers)
//
// Verify:
//  curl -s "https://vyapr-reset-5rly.vercel.app/api/cron/roi-alerts?slug=amitjain0626&dry=1" | jq
//
// Event logged (when triggered):
//  roi.alert.triggered
//  source: {
//    windowDays: 7,
//    prev_paid_sum, curr_paid_sum, delta_pct, basis: "paid_sum"|"bookings",
//    suggestion: "send.reminders|boost.visibility",
//    mode: "dry"|"live"
//  }

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function inr(n: number): string {
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

function sumPaid(rows: any[]): number {
  return rows.reduce((acc: number, r: any) => {
    const src = r?.source || {};
    const amtRaw = src.amount ?? src.am ?? src.payment_amount ?? src["₹"] ?? 0;
    const n = typeof amtRaw === "string" ? parseFloat(amtRaw) : Number(amtRaw);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const isDry = (searchParams.get("dry") || "") === "1";
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing slug" },
        { status: 400 }
      );
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Resolve provider
    let providerId: string | null = null;
    let providerName = slug;
    try {
      const p = await getJSON(`${base}/api/providers/${slug}`);
      const prov = p?.provider || p;
      providerId = prov?.id || null;
      providerName = prov?.display_name || slug;
    } catch {
      // tolerate; fallback to slug
    }

    // Time windows (ms)
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const windowDays = 7;
    const currStart = now - windowDays * DAY;
    const prevStart = now - 2 * windowDays * DAY;
    const prevEnd = currStart;

    // Pull events (generous limit; we filter by ts & provider)
    async function fetchEvents(evt: string) {
      const j = await getJSON(
        `${base}/api/debug/events?event=${encodeURIComponent(evt)}&limit=2000`
      );
      return Array.isArray(j?.rows) ? j.rows : [];
    }
    const [bookingConfirmed, paymentSuccess] = await Promise.all([
      fetchEvents("booking.confirmed"),
      fetchEvents("payment.success"),
    ]);

    function forProviderAndRange(rows: any[], startMs: number, endMs: number) {
      return rows.filter((e: any) => {
        const t = Number(e?.ts || 0);
        if (!Number.isFinite(t) || t < startMs || t >= endMs) return false;
        if (providerId) return e?.provider_id === providerId;
        const src = e?.source;
        return src?.provider_slug === slug || src?.slug === slug;
      });
    }

    // Split rows by window
    const prevBookings = forProviderAndRange(bookingConfirmed, prevStart, prevEnd);
    const currBookings = forProviderAndRange(bookingConfirmed, currStart, now);
    const prevPays = forProviderAndRange(paymentSuccess, prevStart, prevEnd);
    const currPays = forProviderAndRange(paymentSuccess, currStart, now);

    const prev_paid_sum = sumPaid(prevPays);
    const curr_paid_sum = sumPaid(currPays);
    const prev_bookings = prevBookings.length;
    const curr_bookings = currBookings.length;

    // Decide basis: prioritize ₹ paid; if no paid data at all, use bookings count.
    let basis: "paid_sum" | "bookings" = "paid_sum";
    if (prev_paid_sum === 0 && curr_paid_sum === 0) basis = "bookings";

    // Compute drop percentage (only if previous > 0)
    function pctDrop(prev: number, curr: number) {
      if (!Number.isFinite(prev) || prev <= 0) return 0;
      const delta = (prev - curr) / prev; // 0.22 => 22% drop
      return Math.max(0, Math.round(delta * 100));
    }

    const delta_pct =
      basis === "paid_sum"
        ? pctDrop(prev_paid_sum, curr_paid_sum)
        : pctDrop(prev_bookings, curr_bookings);

    const thresholdPct = 10; // trigger if drop >= 10% and prev > 0

    // Helper links
    const leadsUrl = `${base}/dashboard/leads?slug=${encodeURIComponent(slug)}`;
    const nudgeUrl = `${base}/dashboard/nudges?slug=${encodeURIComponent(slug)}&window=h12`;

    // Build human text (used in WA deeplink later)
    const headline = `Weekly ROI Check (${providerName})`;
    const lines: string[] = [];
    if (basis === "paid_sum") {
      lines.push(
        `Prev: ₹${inr(prev_paid_sum)}  →  Now: ₹${inr(curr_paid_sum)}  (${delta_pct}% drop)`
      );
    } else {
      lines.push(
        `Prev bookings: ${prev_bookings}  →  Now: ${curr_bookings}  (${delta_pct}% drop)`
      );
    }
    lines.push(`Open Nudges: ${nudgeUrl}`);
    lines.push(`Leads & ROI: ${leadsUrl}`);
    const message = `${headline}\n${lines.join("\n")}`;
    const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    let triggered = false;
    let suggestion: "send.reminders" | "boost.visibility" | null = null;

    if (delta_pct >= thresholdPct) {
      triggered = true;
      suggestion = curr_bookings === 0 || curr_paid_sum === 0 ? "send.reminders" : "boost.visibility";

      // Log telemetry (append-only)
      try {
        await fetch(`${base}/api/events/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            event: "roi.alert.triggered",
            provider_slug: slug,
            ts: Date.now(),
            source: {
              windowDays,
              prev_paid_sum,
              curr_paid_sum,
              prev_bookings,
              curr_bookings,
              delta_pct,
              basis,
              suggestion,
              leads_url: leadsUrl,
              nudges_url: nudgeUrl,
              mode: isDry ? "dry" : "live",
            },
          }),
        });
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json({
      ok: true,
      slug,
      windowDays,
      basis,
      prev: { paid_sum: prev_paid_sum, bookings: prev_bookings },
      curr: { paid_sum: curr_paid_sum, bookings: curr_bookings },
      delta_pct,
      thresholdPct,
      triggered,
      suggestion,
      wa: { url: wa },
      links: { leads: leadsUrl, nudges: nudgeUrl },
      mode: isDry ? "dry" : "live",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
