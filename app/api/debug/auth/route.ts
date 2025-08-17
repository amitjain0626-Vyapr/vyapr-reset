// app/api/debug/auth/route.ts
// @ts-nocheck

// Force per-request cookie read (no caching)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = createClient();

    // show what cookies the server sees (names only)
    const cookieList = (nextCookies().getAll?.() || []).map((c) => c.name);
    const hasSbCookie = cookieList.some((n) => n.startsWith("sb-"));

    // auth check
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    // also try a minimal RLS query that uses the correct columns in your schema
    let providers_select_ok = false;
    let providers_error: string | null = null;
    try {
      const { error: provErr } = await supabase
        .from("providers")
        .select("id, owner_id, slug")
        .limit(1);
      if (!provErr) providers_select_ok = true;
      else providers_error = provErr.message;
    } catch (e: any) {
      providers_error = e?.message || String(e);
    }

    return NextResponse.json({
      ok: true,
      cookie_names_seen: cookieList,
      has_sb_cookie: hasSbCookie,
      session_present: Boolean(userData?.user),
      user_present: Boolean(userData?.user),
      user_error: userErr?.message || (userData?.user ? null : "Auth session missing!"),
      user: userData?.user || null,
      providers_select_ok,
      providers_error,
      site_url_env: process.env.NEXT_PUBLIC_SITE_URL || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
