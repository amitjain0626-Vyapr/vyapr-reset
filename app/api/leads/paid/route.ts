// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/leads/paid?provider_id=...&leads=<csv_of_lead_ids>
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const provider_id = (u.searchParams.get("provider_id") || "").trim();
    const csv = (u.searchParams.get("leads") || "").trim();
    const ids = csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : [];

    if (!provider_id || ids.length === 0) {
      return NextResponse.json({ ok: true, map: {} });
    }

    const sb = admin();
    const { data = [], error } = await sb
      .from("Events")
      .select("lead_id, ts, source")
      .eq("provider_id", provider_id)
      .eq("event", "payment.success")
      .in("lead_id", ids)
      .order("ts", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    const map: Record<string, { amount: number; ts: number }> = {};
    for (const r of data) {
      const id = r?.lead_id;
      if (!id) continue;
      if (map[id]) continue; // already have latest (because ordered desc)
      const amt = Number(r?.source?.amount || 0) || 0;
      map[id] = { amount: amt, ts: Number(r?.ts || 0) || 0 };
    }

    return NextResponse.json({ ok: true, map });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
