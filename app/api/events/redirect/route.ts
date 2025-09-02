// app/api/events/redirect/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function waUrlFrom(text: string, phone?: string) {
  const enc = encodeURIComponent(text || "");
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    return `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${enc}`;
  }
  return `https://api.whatsapp.com/send?text=${enc}`;
}

function j(msg: any, code = 200) {
  return NextResponse.json(msg, { status: code, headers: { "Cache-Control": "no-store" } });
}

async function postEventViaInternalApi(req: NextRequest, payload: any) {
  // Use relative URL so the request stays within the same deployment
  try {
    const res = await fetch(new URL("/api/events/log", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive is not needed server-to-server, but harmless
      cache: "no-store",
    });
    const ok = res.ok;
    let data: any = null;
    try { data = await res.json(); } catch {}
    return { ok, data, status: res.status };
  } catch (e: any) {
    return { ok: false, data: { error: e?.message || String(e) }, status: 0 };
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const e    = (url.searchParams.get("e")    || "template.sent").trim();
  const kind = (url.searchParams.get("kind") || "offer").trim();
  const slug = (url.searchParams.get("slug") || "").trim() || null;
  const phone = (url.searchParams.get("phone") || "").trim() || undefined;
  const text = url.searchParams.get("text") || "";

  const payload = [{
    event: e,
    ts: Date.now(),
    provider_id: null,           // let /api/events/log resolve (or accept null)
    lead_id: null,
    source: { via: "ui", kind, provider_slug: slug },
  }];

  // 1) Log via internal API (which already has SUPABASE_SERVICE_ROLE configured)
  const result = await postEventViaInternalApi(req, payload[0]);

  // 2a) If debugging, return JSON so we can see exactly what happened
  if (debug) {
    return j({
      ok: result.ok,
      forwarded_to: "/api/events/log",
      status: result.status,
      response: result.data || null,
      note: "When ok=true you should also see this event in /api/debug/events",
    });
  }

  // 2b) Otherwise, redirect to WhatsApp regardless (UX-first)
  const dest = waUrlFrom(text, phone);
  return NextResponse.redirect(dest, { status: 302 });
}
