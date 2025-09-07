// @ts-nocheck
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

/**
 * Funnel API — Leads → Bookings → Paid
 * - Honors the telemetry contract: {event, ts(ms), provider_id, lead_id, source}
 * - Aligns to current events:
 *    • Uses source.kind (not template_kind)
 *    • Surfaces 7d template.sent (sent7d) and booking.landing.opened (opens7d)
 * - If explicit leads are absent, uses opens7d as provisional "leads".
 */
const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  // Pull recent events
  let rows: any[] = [];
  try {
    const r = await fetch(`${SITE}/api/debug/events?limit=5000`, { cache: "no-store" });
    const j = await r.json();
    if (Array.isArray(j?.rows)) rows = j.rows;
  } catch {
    return NextResponse.json({ ok: false, error: "events.fetch_failed" }, { status: 500 });
  }

  // Scope by slug
  const forSlug = rows.filter((r) => {
    const s = r?.source || {};
    return s?.provider_slug === slug || s?.slug === slug;
  });

  // Provider ID (best-effort)
  const providerId = forSlug.find((r) => r?.provider_id)?.provider_id || null;

  // Time helpers
  const now = Date.now();
  const within7d = (ts: number) => now - Number(ts) <= 7 * 24 * 60 * 60 * 1000;

  // Buckets
  const byEvent = (name: string | string[]) => {
    const set = new Set(Array.isArray(name) ? name : [name]);
    return forSlug.filter((r) => set.has(r?.event));
  };

  // Core events (if present)
  const leadEvents = byEvent(["lead.created", "lead.imported"]);
  const bookingEvents = byEvent("booking.created");
  const paymentEvents = byEvent("payment.success");

  // Soft signals (for current dataset)
  const templateSent7d = forSlug.filter((r) => r?.event === "template.sent" && within7d(r?.ts)).length;
  const opens7d = forSlug.filter(
    (r) =>
      r?.event === "booking.landing.opened" &&
      within7d(r?.ts) &&
      // count opens that plausibly came via WA/template
      (r?.source?.campaign === "template-pack" || r?.source?.utm_source === "whatsapp")
  ).length;

  // Unique IDs
  const leadIds = new Set<string>();
  for (const r of leadEvents) if (r?.lead_id) leadIds.add(r.lead_id);

  const bookingLeadIds = new Set<string>();
  for (const r of bookingEvents) if (r?.lead_id) bookingLeadIds.add(r.lead_id);

  const paidLeadIds = new Set<string>();
  for (const r of paymentEvents) if (r?.lead_id) paidLeadIds.add(r.lead_id);

  // Counts
  let leads = leadIds.size;
  const bookings = bookingLeadIds.size;
  const paid = paidLeadIds.size;

  // Provisional fallback: when no explicit leads exist yet, use opens7d as "leads"
  if (leads === 0 && opens7d > 0) {
    leads = opens7d;
  }

  // % helpers
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
  const conv_lead_to_book_pct = pct(bookings, leads);
  const conv_book_to_paid_pct = pct(paid, bookings);
  const conv_lead_to_paid_pct = pct(paid, leads);

  // Lightweight attribution by template kind (based on current contract: source.kind)
  const attribution: Record<string, number> = {};
  for (const r of forSlug) {
    if (r?.event === "booking.created" && r?.source?.kind) {
      const k = r.source.kind;
      attribution[k] = (attribution[k] || 0) + 1;
    }
  }

  return NextResponse.json({
    ok: true,
    provider_id: providerId,
    // Primary funnel
    leads,
    bookings,
    paid,
    conv_lead_to_book_pct,
    conv_book_to_paid_pct,
    conv_lead_to_paid_pct,
    // Soft signals (visibility while campaigns are being sent)
    sent7d: templateSent7d,
    opens7d,
    // Campaign attribution (when bookings exist)
    attribution,
  });
}
