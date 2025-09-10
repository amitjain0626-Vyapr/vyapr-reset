// app/api/debug/supabase/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseOk = Boolean(supabaseUrl && serviceKey);

  let count: number | null = null;
  let sample: Array<{ slug: string; category: string | null; location: string | null }> = [];
  let error: any = null;

  if (baseOk) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch },
      });

      const { data, error: qErr, count: c } = await supabase
        .from("Providers")
        .select("slug, category, location", { count: "exact" })
        .eq("published", true)
        .limit(3);

      count = c ?? null;
      sample = Array.isArray(data) ? data : [];
      if (qErr) error = { message: qErr.message, code: qErr.code, hint: qErr.hint };
    } catch (e: any) {
      error = { message: String(e?.message || e), stack: e?.stack ? "redacted" : undefined };
    }
  }

  // Return only non-sensitive info
  const host = supabaseUrl ? new URL(supabaseUrl).host : null;
  return NextResponse.json({
    ok: true,
    env: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(serviceKey),
      supabaseHost: host, // e.g., xqyvmvktfspovsvwkaet.supabase.co
    },
    query: {
      count,
      sample,
      error,
    },
  });
}
