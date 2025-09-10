// app/api/provider/save-pricing/route.ts
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

    const in_person = Number(form.get("in_person") || 0) || null;
    const phone = Number(form.get("phone") || 0) || null;
    const google_meet = Number(form.get("google_meet") || 0) || null;

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    }

    const sb = admin();
    const { data } = await sb.from("Providers").select("id").eq("slug", slug).maybeSingle();
    if (!data?.id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    const row = {
      event: "provider.pricing.saved",
      ts: Date.now(),
      provider_id: data.id,
      lead_id: null,
      source: { in_person, phone, google_meet },
    };
    await sb.from("Events").insert(row);

    return NextResponse.redirect(
  `${process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app"}/dashboard/settings?slug=${encodeURIComponent(slug)}`
);

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
