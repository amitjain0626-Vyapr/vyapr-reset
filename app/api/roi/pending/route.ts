// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function providerBySlug(slug: string) {
  const sb = admin();
  const { data, error } = await sb.from("Providers").select("id, slug").eq("slug", slug).maybeSingle();
  if (error || !data?.id) throw new Error("provider_not_found");
  return data as { id: string; slug: string };
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
      .in("event", [
        "lead.imported",
        "lead.added",
        "booking.created",
        "booking.confirmed",
        "payment.recorded",
        "payment.success",
        "receipt.issued",
      ]);

    const byLead = new Map<string, { bookAmt: number; payAmt: number }>();
    for (const e of events) {
      const lid = e.lead_id || "unknown";
      const row = byLead.get(lid) || { bookAmt: 0, payAmt: 0 };
      const amt =
        Number(e?.source?.amount ?? e?.source?.price ?? e?.source?.booking_amount ?? 0) || 0;

      if (e.event?.startsWith("booking.")) {
        // take the max booking amount seen for safety
        row.bookAmt = Math.max(row.bookAmt, amt);
      }
      if (e.event?.startsWith("payment.") || e.event === "receipt.issued") {
        row.payAmt += amt;
      }
      byLead.set(lid, row);
    }

    let pendingAmount = 0;
    let pendingCount = 0;
    for (const [, v] of byLead) {
      const due = Math.max((v.bookAmt || 0) - (v.payAmt || 0), 0);
      if (due > 0) {
        pendingAmount += due;
        pendingCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      provider_id: provider.id,
      currency: "INR",
      pending_amount: Math.round(pendingAmount),
      pending_count: pendingCount,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
