// app/api/debug/events/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const sb = admin();
    const url = new URL(req.url);

    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );

    // Optional filter by event name, e.g. ?event=lead.imported
    const eventFilter = url.searchParams.get("event");

    let q = sb
      .from("Events")
      .select("*")
      .order("ts", { ascending: false })
      .limit(limit);

    if (eventFilter) {
      q = q.eq("event", eventFilter);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true, count: data?.length || 0, rows: data || [] });
  } catch (e: any) {
    console.error("debug/events failure:", e);
    return NextResponse.json({ ok: false, error: "debug_events_failed" }, { status: 500 });
  }
}
