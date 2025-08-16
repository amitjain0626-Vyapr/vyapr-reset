// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const { slug, patient_name, phone, note, utm } = body;

    // Find provider by slug
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { ok: false, error: "Provider not found", details: providerError?.message },
        { status: 400 }
      );
    }

    // Insert lead
    const payload = {
      dentist_id: provider.id,
      owner_id: provider.owner_id,
      source_slug: slug,
      patient_name,
      phone: phone.startsWith("+91") ? phone : `+91${phone}`,
      note,
      utm,
      source: "microsite",
      status: "new",
    };

    const { data: lead, error: insertError } = await supabase
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
      { ok: false, error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}
