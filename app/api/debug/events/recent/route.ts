// app/api/debug/events/recent/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function windowStart(key: string) {
  const now = Date.now();
  if (key === "h24") return now - 24 * 60 * 60 * 1000;
  return now - 30 * 24 * 60 * 60 * 1000;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const event = (searchParams.get("event") || "nudge.suggested").trim();
    const win = (searchParams.get("window") || "d30").trim().toLowerCase();

    // 2 lines before
    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    // << insert >>
    // look up provider_id by slug (service role, read-only)
    // 2 lines after

    const { data: prov } = await admin().from("Providers").select("id").eq("slug", slug).maybeSingle();
    const provider_id = prov?.id || null;
    if (!provider_id) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });

    const since = windowStart(win);
    const { data = [], error } = await admin()
      .from("Events")
      .select("lead_id, ts, source")
      .eq("provider_id", provider_id)
      .eq("event", event)
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(1000);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, slug, event, window: win, rows: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
