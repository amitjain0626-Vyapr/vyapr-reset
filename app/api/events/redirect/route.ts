// app/api/events/redirect/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin"; // use the path you already have

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1"; // when true, respond JSON instead of redirect

  const e = (url.searchParams.get("e") || "").trim() || "template.sent";
  const kind = (url.searchParams.get("kind") || "").trim() || "offer";
  const slug = (url.searchParams.get("slug") || "").trim() || null;
  const phone = (url.searchParams.get("phone") || "").trim() || undefined;
  const text = url.searchParams.get("text") || "";

  // 1) Prepare insert payload
  let provider_id: string | null = null;
  let resolveErr: string | null = null;
  let insertErr: string | null = null;
  let ok = false;

  try {
    const supa = createAdminClient();

    // Soft resolve provider_id from slug (don’t fail if not found)
    if (slug) {
      const { data, error } = await supa
        .from("Dentists")
        .select("id, created_at")
        .eq("slug", slug)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        resolveErr = error.message || String(error);
      } else if (data && data.length > 0) {
        provider_id = data[0].id || null;
      }
    }

    // Insert
    const payload = [
      {
        event: e,
        ts: Date.now(),
        provider_id: provider_id || null,
        lead_id: null,
        source: { via: "ui", kind, provider_slug: slug },
      },
    ];
    const { error: insErr } = await supa.from("Events").insert(payload);
    if (insErr) {
      insertErr = insErr.message || String(insErr);
      ok = false;
    } else {
      ok = true;
    }
  } catch (ex: any) {
    insertErr = ex?.message || String(ex);
    ok = false;
  }

  // 2) In debug mode, show exactly what happened (no redirect)
  if (debug) {
    return j({
      ok,
      event: e,
      provider_id,
      resolve_error: resolveErr,
      insert_error: insertErr,
      note: "When ok=true you should also see this event in /api/debug/events",
    });
  }

  // 3) Otherwise, redirect to WhatsApp regardless (UX first)
  const dest = waUrlFrom(text, phone);
  return NextResponse.redirect(dest, { status: 302 });
}
