// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function providerBySlug(slug: string) {
  const sb = admin();
  const { data, error } = await sb.from("Providers").select("id, slug, display_name").eq("slug", slug).maybeSingle();
  if (error || !data?.id) throw new Error("provider_not_found");
  return data as { id: string; slug: string; display_name?: string | null };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

    const provider = await providerBySlug(slug);
    const sb = admin();

    const { data: events = [] } = await sb
      .from("Events")
      .select("lead_id, event, ts, source")
      .eq("provider_id", provider.id)
      .in("event", ["booking.created", "booking.confirmed", "payment.recorded", "payment.success", "receipt.issued"]);

    const byLead = new Map<string, { bookAmt: number; payAmt: number }>();
    for (const e of events) {
      const lid = e.lead_id || "unknown";
      const row = byLead.get(lid) || { bookAmt: 0, payAmt: 0 };
      const amt = Number(e?.source?.amount ?? e?.source?.price ?? 0) || 0;
      if (e.event?.startsWith("booking.")) row.bookAmt = Math.max(row.bookAmt, amt);
      if (e.event?.startsWith("payment.") || e.event === "receipt.issued") row.payAmt += amt;
      byLead.set(lid, row);
    }

    const items: any[] = [];
    for (const [lead_id, v] of byLead) {
      const due = Math.max((v.bookAmt || 0) - (v.payAmt || 0), 0);
      if (due > 0) {
        const payUrl = `${SITE}/pay/${lead_id}?slug=${encodeURIComponent(slug)}&amount=${due}`;
        const msg = `Hi, quick payment link for your booking with ${provider.display_name || slug}: ${payUrl}`;
        const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        items.push({ lead_id, amount_due: due, currency: "INR", pay_url: payUrl, wa_url: wa });
      }
    }

    return NextResponse.json({ ok: true, provider_id: provider.id, items, count: items.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
