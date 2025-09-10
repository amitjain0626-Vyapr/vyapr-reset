// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app";

export async function GET(req: Request, context: any) {
  try {
    const slug = (context?.params?.slug || "").trim();
    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data } = await sb
      .from("Providers")
      .select("slug, display_name, phone, whatsapp, category, location, image, bio")
      .eq("slug", slug)
      .maybeSingle();

    const p = data || {
      slug,
      display_name: slug,
      phone: null,
      whatsapp: null,
      category: null,
      location: null,
      image: null,
      bio: null,
    };

    const bookingUrl = `${SITE}/book/${encodeURIComponent(slug)}`;
    const siteUrl = `${SITE}/microsite/${encodeURIComponent(slug)}`;

    const rawPhone = (p?.whatsapp || p?.phone || "").toString().replace(/[^\d+]/g, "");
    const tel = rawPhone ? `+${rawPhone.replace(/^\+/, "")}` : "";

    // vCard 3.0 (widely compatible)
    const lines: string[] = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${(p?.display_name || slug).replace(/\r?\n/g, " ")}`,
      `ORG:${(p?.display_name || "Korekko Provider").replace(/\r?\n/g, " ")}`,
    ];
    if (tel) lines.push(`TEL;TYPE=CELL,VOICE:${tel}`);
    if (p?.location) lines.push(`ADR;TYPE=WORK:;;${p.location};;;;`);
    lines.push(`URL:${siteUrl}`);
    lines.push(`NOTE:${["Category: " + (p?.category || "Services"), "Booking: " + bookingUrl].join(" | ")}`);
    lines.push("END:VCARD");

    const body = lines.join("\r\n");
    const filename = `${slug}.vcf`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "internal_error" }, { status: 500 });
  }
}
