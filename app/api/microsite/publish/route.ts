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

// === VYAPR: debug helper (22.15) START ===
function dbg(tag: string, e: any, extra?: any) {
  const o = e || {};
  return {
    tag,
    code: o.code ?? null,
    message: o.message ?? null,
    details: o.details ?? null,
    hint: o.hint ?? null,
    extra: extra ?? null,
  };
}
// === VYAPR: debug helper (22.15) END ===

export async function POST(req: Request) {
  try {
    // === VYAPR: debug flag (22.15) START ===
    const debug = (() => {
      try { return new URL(req.url).searchParams.get('debug') === '1'; } catch { return false; }
    })();
    // === VYAPR: debug flag (22.15) END ===
    const body = (await req.json().catch(() => ({}))) || {};
    const about = (body.about || "About us coming soon…").toString();
    const services = Array.isArray(body.services) && body.services.length
      ? body.services
      : ["General consultation"];
    const provider_slug = (body.provider_slug || "").trim();

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
            if (e1) return NextResponse.json({ ok: false, error: debug ? dbg('provider_lookup', e1, { provider_slug }) : (e1.message || "provider_lookup_failed") }, { status: 400 });
      if (!row?.id) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
      provider_id = row.id;
      sb = admin();
    }

    const { error } = await sb
      .from("Microsite")
      .upsert(
        { provider_id, about, services, updated_at: new Date().toISOString() },
        { onConflict: "provider_id" }
      );
// === VYAPR: fallback to Providers if Microsite table missing (22.15) START ===
    if (error) {
      // Try writing directly to Providers: bio = about, services, published = true
      const { error: pfErr } = await sb
        .from("Providers")
        .update({ bio: about, services, published: true, updated_at: new Date().toISOString() })
        .eq("id", provider_id);

      if (!pfErr) {
        // best-effort telemetry
        const base2 = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
        fetch(`${base2}/api/events/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "microsite.published",
            provider_id,
            source: { via: "providers_fallback" }
          }),
          keepalive: true,
        }).catch(() => {});

        return NextResponse.json({ ok: true, provider_id, about, services, via: "providers_fallback" });
      }
      // If fallback also failed, continue to the existing error return below
    }
    // === VYAPR: fallback to Providers if Microsite table missing (22.15) END ===
      
        if (error) return NextResponse.json({ ok: false, error: debug ? dbg('microsite_upsert', error, { provider_id }) : (error.message || "microsite_upsert_failed") }, { status: 400 });    // telemetry (best effort)

        // === VYAPR: publish flag (22.15) START ===
    const { error: pErr } = await sb
      .from("Providers")
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq("id", provider_id);
        if (pErr) return NextResponse.json({ ok: false, error: debug ? dbg('publish_update', pErr, { provider_id }) : (pErr.message || "publish_update_failed") }, { status: 400 });

    // === VYAPR: publish flag (22.15) END ===

    // telemetry (best effort)
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
    fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "microsite.published", provider_id, source: { via: auth?.user ? "auth" : "admin" } }),
      keepalive: true,
    }).catch(() => {});

    return NextResponse.json({ ok: true, provider_id, about, services });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "publish_failed" }, { status: 500 });
  }
}
