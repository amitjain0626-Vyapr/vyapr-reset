// @ts-nocheck
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app";

/**
 * Computes last 7d vs previous 7d "paid" count as proxy for ROI trend.
 * If drop detected, logs alert.roi.drop (via /api/events/log) and returns advisory.
 * Can be invoked manually now; cron later.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const slug = (b?.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  // Get events (we'll compute week-over-week paid counts)
  let rows: any[] = [];
  try {
    const r = await fetch(`${SITE}/api/debug/events?limit=5000`, { cache: "no-store" });
    const j = await r.json();
    if (Array.isArray(j?.rows)) rows = j.rows;
  } catch {
    return NextResponse.json({ ok: false, error: "events.fetch_failed" }, { status: 500 });
  }

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const t0 = now - weekMs;
  const tPrev0 = now - 2 * weekMs;

  const forSlug = rows.filter((r) => {
    const s = r?.source || {};
    return (s?.provider_slug === slug) || (s?.slug === slug);
  });

  const paidEvents = forSlug.filter((r) => r?.event === "payment.success");

  const paidLast7 = paidEvents.filter((r) => Number(r?.ts) >= t0).length;
  const paidPrev7 = paidEvents.filter((r) => Number(r?.ts) >= tPrev0 && Number(r?.ts) < t0).length;

  const dropped = paidPrev7 > 0 && paidLast7 < paidPrev7;

  if (dropped) {
    // Log alert.roi.drop
    await fetch(`${SITE}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "alert.roi.drop",
        ts: Date.now(),
        provider_id: forSlug.find((r) => r?.provider_id)?.provider_id || null,
        lead_id: null,
        source: {
          provider_slug: slug,
          paid_last7: paidLast7,
          paid_prev7: paidPrev7,
          suggestion: "Try Boost or send Re-activation campaign",
        },
      }),
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    slug,
    paid_last7: paidLast7,
    paid_prev7: paidPrev7,
    dropped,
    suggestion: dropped ? "Boost visibility or send re-activation nudge" : null,
  });
}
