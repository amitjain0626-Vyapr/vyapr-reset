// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function cleanUpi(v?: string | null) {
  const s = String(v || "").trim().toLowerCase();
  // basic guard, allow @ and dots
  return s.replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const provider_id = String(body?.provider_id || "").trim();
    const upi_id = cleanUpi(body?.upi_id);

    if (!provider_id || !upi_id) {
      return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 });
    }

    const sb = admin();

    // 1) Always write an event (source of truth for MVP)
    const { error: evErr } = await sb.from("Events").insert({
      event: "provider.upi.saved",
      ts: Date.now(),
      provider_id,
      source: { upi_id },
    });
    if (evErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

    // 2) Best-effort: also set Providers.upi_id if column exists (ignore failures)
    try {
      await sb.from("Providers").update({ upi_id }).eq("id", provider_id);
    } catch {}

    return NextResponse.json({ ok: true, upi_id });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
