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

function isSafeDest(to: string) {
  if (!to) return false;
  try {
    // allow relative app paths
    if (to.startsWith("/")) return true;
    // allow absolute http(s)
    const u = new URL(to);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  // accept both ?e= and ?event=
  const eRaw  = (url.searchParams.get("event") || url.searchParams.get("e") || "template.sent").trim();

  const kind  = (url.searchParams.get("kind") || "offer").trim();
  const slug  = (url.searchParams.get("slug") || "").trim() || null;
  const pid   = (url.searchParams.get("pid")  || "").trim() || null;
  const key   = (url.searchParams.get("key")  || "").trim() || null; // nudge key, template key, etc
  const aud   = (url.searchParams.get("aud")  || "").trim() || null;
  const media = (url.searchParams.get("media")|| "").trim() || null;
  const phone = (url.searchParams.get("phone")|| "").trim() || undefined;
  const text  = url.searchParams.get("text") || "";
  const to    = url.searchParams.get("to") || "";

  const payload = {
    event: eRaw,
    ts: Date.now(),
    provider_id: pid || null,
    lead_id: null,
    source: {
      via: "ui.redirect",
      kind,
      provider_slug: slug,
      key,                // e.g. upsell nudge key
      audience: aud || "all",
      media_url: media || null,
      dest_kind: to ? (to.startsWith("/") ? "internal" : "external") : "whatsapp",
    },
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

  // Prefer explicit destination (?to=). Fallback to WhatsApp text link.
  let dest = "";
  if (isSafeDest(to)) {
    dest = to.startsWith("/") ? to : to; // NextResponse.redirect handles absolute too
  } else {
    dest = waUrlFrom(text, phone);
  }

  return NextResponse.redirect(dest, { status: 302 });
}
