// app/api/leads/reschedule/route.ts
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

async function getProviderIdBySlug(slug: string) {
  if (!slug) return null;
  const sb = admin();
  const { data } = await sb.from("Providers").select("id").eq("slug", slug).maybeSingle();
  return data?.id || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = (body.slug || "").toString().trim();
    const lead_id = (body.lead_id || "").toString().trim();
    const slotISO = (body.slotISO || "").toString().trim();

    if (!slug || !lead_id || !slotISO) {
      return NextResponse.json({ ok: false, error: "missing slug/lead_id/slotISO" }, { status: 400 });
    }

    const provider_id = await getProviderIdBySlug(slug);
    if (!provider_id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    const { error } = await admin().from("Events").insert({
      event: "booking.reschedule.requested",
      ts: Date.now(),
      provider_id,
      lead_id,
      source: { via: "api", slotISO },
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
