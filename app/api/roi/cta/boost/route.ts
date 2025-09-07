// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

    // lightweight hints; later can be computed from traffic/conversion
    const suggestions = [
      { key: "share_qr", label: "Share your QR in stories", action_url: `/vcard/${slug}` },
      { key: "add_services", label: "Add services & pricing", action_url: `/settings?slug=${slug}` },
      { key: "enable_wa", label: "Enable WhatsApp chat", action_url: `/book/${slug}` },
    ];
    return NextResponse.json({ ok: true, slug, suggestions });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
