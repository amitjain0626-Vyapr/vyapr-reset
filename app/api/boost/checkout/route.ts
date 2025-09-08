// app/api/boost/checkout/route.ts
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

async function logEvents(provider_id: string, via: string) {
  const ts = Date.now();
  const rows = [
    {
      event: "boost.checkout",
      ts,
      provider_id,
      lead_id: null,
      source: { via },
    },
    {
      event: "boost.activated",
      ts: ts + 1, // keep ordering stable
      provider_id,
      lead_id: null,
      source: { via },
    },
  ];
  return admin().from("Events").insert(rows);
}

/* ---------- POST /api/boost/checkout?slug=... ---------- */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const test = (searchParams.get("test") || "").trim() === "1";

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    }

    const provider_id = await resolveProviderIdBySlug(slug);
    if (!provider_id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    const { error } = await logEvents(provider_id, "ui");
    if (error) {
      return NextResponse.json({ ok: false, error: "event_insert_failed", detail: error.message }, { status: 400 });
    }

    // For automation-friendly verification: when ?test=1, return JSON instead of redirect.
    if (test) {
      return NextResponse.json({ ok: true, event: "boost.activated", slug });
    }

    // Normal flow: redirect back to dashboard with a lightweight success marker.
    const to = `/dashboard/leads?slug=${encodeURIComponent(slug)}&boost=activated`;
    return NextResponse.redirect(new URL(to, req.url), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
