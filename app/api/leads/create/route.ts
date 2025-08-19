// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { slug, patient_name, phone, note } = await req.json();

    if (!slug || !patient_name || !phone) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST be set
    if (!SUPABASE_URL || !SRK) {
      return NextResponse.json(
        {
          ok: false,
          error: "Service role not configured",
          details: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env",
        },
        { status: 500 }
      );
    }

    // Service role client bypasses RLS (intended for trusted server routes)
    const supabase = createClient(SUPABASE_URL, SRK, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Resolve provider (only published)
    const { data: provider, error: provErr } = await supabase
      .from("Providers")
      .select("id, slug, published")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (provErr || !provider) {
      return NextResponse.json({ ok: false, error: "Provider not found or not published" }, { status: 404 });
    }

    // 2) Insert lead
    const payload = {
      provider_id: provider.id,
      patient_name: String(patient_name).slice(0, 120),
      phone: String(phone).slice(0, 30),
      note: note ? String(note).slice(0, 1000) : null,
      status: "new",
      source: "microsite",
    };

    const { data: lead, error: leadErr } = await supabase
      .from("Leads")
      .insert(payload)
      .select("id, created_at")
      .single();

    if (leadErr) {
      return NextResponse.json({ ok: false, error: "Insert failed", details: leadErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, lead_id: lead.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
