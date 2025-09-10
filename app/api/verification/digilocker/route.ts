// app/api/verification/digilocker/route.ts
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

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const slug = String(form.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    }

    const sb = admin();
    const { data: prov } = await sb.from("Providers").select("id").eq("slug", slug).maybeSingle();
    if (!prov?.id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    // Log stub event (later: integrate DigiLocker OAuth)
    await sb.from("Events").insert({
      event: "provider.digilocker.requested",
      ts: Date.now(),
      provider_id: prov.id,
      lead_id: null,
      source: { slug },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app"}/settings/verification?slug=${encodeURIComponent(slug)}`
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
