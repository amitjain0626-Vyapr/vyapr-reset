// app/api/analytics/export/route.ts
// @ts-nocheck
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

const SITE = BRAND.baseUrl; // centralized (no hard-coded vyapr domain)

/**
 * Builds a forwardable WhatsApp ROI-proof text card.
 * Returns { ok, text, wa_url }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  }

  // Fetch funnel + pending JSONs we already expose
  const [funnel, pending] = await Promise.all([
    fetch(`${SITE}/api/analytics/funnel?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
    fetch(`${SITE}/api/roi/pending?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({})),
  ]);

  const leads = funnel?.leads ?? 0;
  const bookings = funnel?.bookings ?? 0;
  const paid = funnel?.paid ?? 0;
  const pctLB = funnel?.conv_lead_to_book_pct ?? 0;
  const pctBP = funnel?.conv_book_to_paid_pct ?? 0;
  const pctLP = funnel?.conv_lead_to_paid_pct ?? 0;

  const pendingAmt = pending?.pending_amount ?? 0;
  const pendingCnt = pending?.pending_count ?? 0;

  const header = `${BRAND.name} ROI (Provider: ${slug})`; // was "Vyapr ROI"
  const lines = [
    header,
    `Leads → Bookings → Paid: ${leads} → ${bookings} → ${paid}`,
    `Conversions: L→B ${pctLB}%, B→P ${pctBP}%, L→P ${pctLP}%`,
    `Pending ₹: ₹${Math.round(pendingAmt)} (${pendingCnt} dues)`,
    `Proof link: ${SITE}/dashboard?slug=${encodeURIComponent(slug)}`,
  ];

  const text = lines.join("\n");
  const wa_url = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return NextResponse.json({ ok: true, text, wa_url });
}
