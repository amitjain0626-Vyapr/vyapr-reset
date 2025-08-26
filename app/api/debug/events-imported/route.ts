// app/api/debug/events-imported/route.ts
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
      Math.max(parseInt(url.searchParams.get("limit") || "5", 10) || 5, 1),
      50
    );

    const { data, error } = await sb
      .from("Events")                 // match your casing
      .select("*")
      .eq("event", "lead.imported")   // hard filter
      .order("ts", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true, count: data?.length || 0, rows: data || [] });
  } catch (e: any) {
    console.error("debug/events-imported failure:", e);
    return NextResponse.json({ ok: false, error: "debug_events_imported_failed" }, { status: 500 });
  }
}
