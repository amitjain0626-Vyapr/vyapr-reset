// @ts-nocheck
// Node runtime (service role insert; RLS remains enabled)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { lead_id, text } = body as { lead_id?: string; text?: string };

    if (!lead_id || !text || String(text).trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "lead_id and text are required" },
        { status: 400 }
      );
    }

    const supabase = getAdmin();

    // Resolve provider_id from Leads
    const { data: lead, error: lErr } = await supabase
      .from("Leads")
      .select("id, provider_id")
      .eq("id", lead_id)
      .single();

    if (lErr || !lead) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Insert note as an Event
    const row = {
      event: "note.provider.added",
      ts: Date.now(),
      provider_id: lead.provider_id,
      lead_id: lead.id,
      source: { via: "ui", text: String(text).trim() },
    };

    const { error: eErr } = await supabase.from("Events").insert(row);
    if (eErr) {
      return NextResponse.json(
        { ok: false, error: eErr.message || "Insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
