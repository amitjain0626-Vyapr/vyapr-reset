// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const provider_id = String(body?.provider_id || "").trim();
    const lead_id = String(body?.lead_id || "").trim();
    const amountNum = Number(body?.amount);
    const amount = Math.round(isFinite(amountNum) ? amountNum : 0);
    const method = String(body?.method || "upi").trim().toLowerCase();

    if (!provider_id || !lead_id || !amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_params" },
        { status: 400 }
      );
    }

    const row = {
      event: "payment.success",
      ts: Date.now(),
      provider_id,
      lead_id,
      source: { amount, method, via: "manual" },
    };

    const sb = admin();
    const { error } = await sb.from("Events").insert(row);
    if (error) {
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
