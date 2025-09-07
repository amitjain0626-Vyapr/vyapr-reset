// app/api/microsite/publish/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) || {};
    const about = (body.about || "About us coming soon…").toString();
    const services =
      Array.isArray(body.services) && body.services.length ? body.services : ["General consultation"];
    const provider_slug = (body.provider_slug || "").trim();

    // Auth: prefer logged-in; otherwise allow admin path via slug
    const sbUser = createSupabaseServerClient();
    const { data: auth } = await sbUser.auth.getUser();

    let sb = sbUser;
    let provider_id: string | null = null;

    if (auth?.user?.id) {
      provider_id = auth.user.id;
    } else {
      if (!provider_slug) {
        return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
      }
      const { data: row, error: e1 } = await admin()
        .from("Providers")
        .select("id")
        .eq("slug", provider_slug)
        .maybeSingle();
      if (e1) return NextResponse.json({ ok: false, error: "provider_lookup_failed" }, { status: 400 });
      if (!row?.id) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
      provider_id = row.id;
      sb = admin(); // service role for server-side action
    }

    // ✅ Single source of truth = Providers (no Microsite table)
    const { error: pErr } = await sb
      .from("Providers")
      .update({ bio: about, services, published: true, updated_at: new Date().toISOString() })
      .eq("id", provider_id);

    if (pErr) {
      return NextResponse.json({ ok: false, error: "publish_update_failed" }, { status: 400 });
    }

    // Best-effort telemetry
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
    fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "microsite.published",
        ts: Date.now(),
        provider_id,
        lead_id: null,
        source: { via: auth?.user ? "auth" : "admin", kind: "providers_only" },
      }),
      keepalive: true,
    }).catch(() => {});

    return NextResponse.json({ ok: true, provider_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "publish_failed" }, { status: 500 });
  }
}
