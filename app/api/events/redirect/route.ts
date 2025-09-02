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
  try {
    const res = await fetch(new URL("/api/events/log", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  const e     = (url.searchParams.get("e")    || "template.sent").trim();
  const kind  = (url.searchParams.get("kind") || "offer").trim();
  const slug  = (url.searchParams.get("slug") || "").trim() || null;
  const pid   = (url.searchParams.get("pid")  || "").trim() || null; // NEW: provider_id coming from client
  const phone = (url.searchParams.get("phone") || "").trim() || undefined;
  const text  = url.searchParams.get("text") || "";

  const payload = {
    event: e,
    ts: Date.now(),
    provider_id: pid || null,  // MUST be non-null to satisfy NOT NULL
    lead_id: null,
    source: { via: "ui", kind, provider_slug: slug },
  };

  const result = await postEventViaInternalApi(req, payload);

  if (debug) {
    return j({
      ok: result.ok,
      forwarded_to: "/api/events/log",
      status: result.status,
      response: result.data || null,
      note: "When ok=true you should also see this event in /api/debug/events",
    });
  }

  const dest = waUrlFrom(text, phone);
  return NextResponse.redirect(dest, { status: 302 });
}
