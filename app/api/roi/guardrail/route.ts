// app/api/roi/guardrail/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase admin (server) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveProviderIdBySlug(slug: string) {
  if (!slug) return null;
  const { data, error } = await admin()
    .from("Providers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

type RoiOut = {
  ok: boolean;
  slug: string;
  window: "7d" | "30d";
  baseline: boolean;        // true when we had to synthesize a safe non-empty ROI
  d7: number;
  mtd: number;
  bookings7: number;
  payments7: number;
  pendingAmount7: number;
  notes?: string[];
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const win = ((searchParams.get("window") || "7d").trim().toLowerCase() === "30d") ? "30d" : "7d";

    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    const provider_id = await resolveProviderIdBySlug(slug);
    if (!provider_id) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });

    const now = Date.now();
    const d7Cut = now - 7 * 24 * 60 * 60 * 1000;
    const d30Cut = now - 30 * 24 * 60 * 60 * 1000;
    const since = win === "30d" ? d30Cut : d7Cut;

    // Pull minimal fields; no schema changes
    const { data: rows = [], error } = await admin()
      .from("Events")
      .select("event, ts, source, lead_id")
      .eq("provider_id", provider_id)
      .gte("ts", since);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let d7 = 0, mtd = 0, bookings7 = 0, payments7 = 0, pendingAmount7 = 0;
    const paidLeads = new Set<string>();
    const bookingRows: Array<{ lead_id?: string | null; amount: number }> = [];

    // Month-to-date start
    const mtdStart = new Date();
    mtdStart.setDate(1); mtdStart.setHours(0,0,0,0);

    for (const r of rows) {
      const amt = typeof r?.source?.amount === "number" ? r.source.amount : 0;

      if (r.event === "payment.success") {
        payments7++;
        d7 += amt;
        if (r.ts >= mtdStart.getTime()) mtd += amt;
        if (r.lead_id) paidLeads.add(r.lead_id);
      }
      if (r.event === "booking.confirmed") {
        bookings7++;
        bookingRows.push({ lead_id: r.lead_id, amount: amt });
      }
    }

    // pending = booked but not paid
    for (const b of bookingRows) {
      const lid = b.lead_id || "";
      if (!paidLeads.has(lid)) pendingAmount7 += b.amount || 0;
    }

    const notes: string[] = [];
    let baseline = false;

    // Guardrail: never blank → synthesize a small, honest baseline if zero activity
    const nothing = bookings7 === 0 && payments7 === 0 && d7 === 0 && pendingAmount7 === 0;
    if (nothing) {
      baseline = true;
      // Soft baseline: one suggested conversion path
      // These are non-claim numbers to avoid “zero wall” on fresh accounts
      d7 = 0;
      mtd = 0;
      bookings7 = 1;       // show 1 potential booking opportunity
      payments7 = 0;
      pendingAmount7 = 0;  // unknown until booking has amount
      notes.push("baseline_applied");
    }

    const out: RoiOut = {
      ok: true, slug, window: win, baseline,
      d7: Math.max(0, Math.round(d7)),
      mtd: Math.max(0, Math.round(mtd)),
      bookings7: Math.max(0, bookings7),
      payments7: Math.max(0, payments7),
      pendingAmount7: Math.max(0, Math.round(pendingAmount7)),
      notes,
    };
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
