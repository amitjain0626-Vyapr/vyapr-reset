// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
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
      .select("lead_id, event")
      .eq("provider_id", provider.id)
      .in("event", [
        "lead.imported",
        "lead.added",
        "lead.created",
        "booking.created",
        "booking.confirmed",
        "payment.recorded",
        "payment.success",
        "receipt.issued",
      ]);

    const leadSet = new Set<string>();
    const bookSet = new Set<string>();
    const paidSet = new Set<string>();
    for (const e of events) {
      const lid = e.lead_id || "unknown";
      if (e.event?.startsWith("lead.")) leadSet.add(lid);
      if (e.event?.startsWith("booking.")) bookSet.add(lid);
      if (e.event?.startsWith("payment.") || e.event === "receipt.issued") paidSet.add(lid);
    }
    const leads = leadSet.size;
    const bookings = bookSet.size;
    const paid = paidSet.size;

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

    return NextResponse.json({
      ok: true,
      provider_id: provider.id,
      leads,
      bookings,
      paid,
      conv_lead_to_book_pct: pct(bookings, leads),
      conv_book_to_paid_pct: pct(paid, bookings),
      conv_lead_to_paid_pct: pct(paid, leads),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
