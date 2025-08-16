// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 1) Session / user (cookie-based)
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    // 2) Tiny DB probes (no RLS secrets)
    const provProbe = await supabase
      .from("providers")
      .select("id", { count: "exact", head: true });

    const msProbe = await supabase
      .from("microsites")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      ok: true,
      env: {
        supabaseUrl_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        supabaseAnon_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        node_env: process.env.NODE_ENV || "unknown",
      },
      auth: {
        session_present: Boolean(sessionData?.session),
        user_present: Boolean(userData?.user),
        user_error: userErr?.message || null,
        user: userData?.user ? { id: userData.user.id, email: userData.user.email } : null,
      },
      db: {
        providers_count_ok: provProbe?.status === 200,
        providers_error: provProbe?.error?.message || null,
        microsites_count_ok: msProbe?.status === 200,
        microsites_error: msProbe?.error?.message || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "health_check_failed", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
