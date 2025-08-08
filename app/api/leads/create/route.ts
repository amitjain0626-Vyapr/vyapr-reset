// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

type Body = {
  slug?: string;
  dentistId?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const body = (await req.json()) as Body;

    let dentistId = body.dentistId?.trim() || "";
    if (!dentistId) {
      const slug = (body.slug || "").toLowerCase().trim();
      if (!slug) {
        return NextResponse.json({ error: "slug or dentistId required" }, { status: 400 });
      }
      const { data: dentist, error: dErr } = await supabase
        .from("Dentists")
        .select("id, is_published")
        .ilike("slug", slug)
        .maybeSingle();
      if (dErr || !dentist) {
        return NextResponse.json({ error: "dentist not found" }, { status: 404 });
      }
      if (!dentist.is_published) {
        return NextResponse.json({ error: "dentist not published" }, { status: 403 });
      }
      dentistId = dentist.id;
    }

    const payload = {
      dentist_id: dentistId,
      name: (body.name || "").trim().slice(0, 120) || null,
      email: (body.email || "").trim().slice(0, 160) || null,
      phone: (body.phone || "").trim().slice(0, 32) || null,
      message: (body.message || "").trim().slice(0, 1000) || null,
      source: (body.source || "microsite").trim().slice(0, 40),
      status: "new",
    };

    const { data, error } = await supabase.from("Leads").insert(payload).select("id, created_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, lead: data?.[0] || null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
