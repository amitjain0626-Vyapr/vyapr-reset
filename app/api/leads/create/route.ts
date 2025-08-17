// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: if bots fill "website", say success but do nothing
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      return new NextResponse(null, { status: 204 });
    }

    const slug = String(body.slug || "").trim().toLowerCase();
    const patient_name = String(body.patient_name || "").trim();
    const phone_raw = String(body.phone || "").trim();
    const note = (body.note ?? "").toString().slice(0, 1000);
    const utm = body.utm && typeof body.utm === "object" ? body.utm : {};

    if (!slug || !patient_name || !phone_raw) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields (slug, patient_name, phone)" },
        { status: 400 }
      );
    }

    // Clean phone (+91 if 10 digits)
    const digits = phone_raw.replace(/[^\d+]/g, "");
    const phone =
      /^\d{10}$/.test(digits) ? `+91${digits}` :
      /^\+?\d{7,15}$/.test(digits) ? (digits.startsWith("+") ? digits : `+${digits}`) :
      null;

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Invalid phone format" },
        { status: 400 }
      );
    }

    // Fetch provider by slug (admin client to avoid RLS)
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("id, owner_id, slug")
      .eq("slug", slug)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { ok: false, error: "Provider not found", details: providerError?.message },
        { status: 404 }
      );
    }

    const payload = {
      dentist_id: provider.id,
      owner_id: provider.owner_id,
      source_slug: slug,
      slug, // keep for compatibility if your table has this column
      patient_name,
      phone,
      note,
      utm,
      source: "microsite",
      status: "new",
    };

    // Insert lead with admin client (bypasses RLS)
    const { data: lead, error: insertError } = await supabaseAdmin
      .from("leads")
      .insert([payload])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: "Insert failed", details: insertError.message, attempted_payload: payload },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Server error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
