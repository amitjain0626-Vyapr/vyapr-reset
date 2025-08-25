// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient as createSb } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const payload = body?.payload ?? {};
    if (!name) return NextResponse.json({ ok: false, error: "missing name" }, { status: 400 });

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });

    const admin = createSb(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const nowISO = new Date().toISOString();
    let okCount = 0;

    // Try rich
    const r1 = await admin.from("Events").insert([{ name, type: name, payload, created_at: nowISO }]).select("name");
    if (!r1.error) okCount = (r1.data || []).length;
    else {
      // Try minimal with created_at
      const r2 = await admin.from("Events").insert([{ name, created_at: nowISO }]).select("name");
      if (!r2.error) okCount = (r2.data || []).length;
      else {
        // Final fallback: name only
        const r3 = await admin.from("Events").insert([{ name }]).select("name");
        if (!r3.error) okCount = (r3.data || []).length;
      }
    }

    return NextResponse.json({ ok: true, wrote: okCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
