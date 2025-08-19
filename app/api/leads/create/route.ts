// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function mask(str?: string | null, keep = 6) {
  if (!str) return "";
  const tail = str.slice(-keep);
  return `${"*".repeat(Math.max(0, str.length - keep))}${tail}`;
}

export async function POST(req: Request) {
  const stage = { where: "start" };
  try {
    const { slug, patient_name, phone, note } = await req.json();

    if (!slug || !patient_name || !phone) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Hard check env
    if (!SUPABASE_URL || !SRK) {
      return NextResponse.json(
        {
          ok: false,
          error: "Service role not configured",
          details: {
            url_set: Boolean(SUPABASE_URL),
            srk_set: Boolean(SRK),
            vercel_env: process.env.VERCEL_ENV || null,
          },
        },
        { status: 500 }
      );
    }

    // Build payload
    const payload = {
      patient_name: String(patient_name).slice(0, 120),
      phone: String(phone).slice(0, 30),
      note: note ? String(note).slice(0, 1000) : null,
      status: "new",
      source: "microsite",
    };

    // 0) Quick ping to ensure SRK works
    stage.where = "ping";
    const supabase = createClient(SUPABASE_URL, SRK, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ping = await supabase.from("Providers").select("id").limit(1);
    if (ping.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "SRK ping failed",
          details: ping.error.message,
          diag: { url: SUPABASE_URL, srk_tail: mask(SRK) },
        },
        { status: 500 }
      );
    }

    // 1) Resolve provider (published only)
    stage.where = "resolve_provider";
    const { data: provider, error: provErr } = await supabase
      .from("Providers")
      .select("id, slug")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (provErr || !provider) {
      return NextResponse.json(
        {
          ok: false,
          error: "Provider not found or not published",
          details: provErr?.message ?? null,
        },
        { status: 404 }
      );
    }

    // try supabase-js insert first
    stage.where = "insert_supabase_js";
    const { data: lead, error: leadErr } = await supabase
      .from("Leads")
      .insert({ ...payload, provider_id: provider.id })
      .select("id, created_at")
      .single();

    if (!leadErr && lead) {
      return NextResponse.json({ ok: true, lead_id: lead.id });
    }

    // 2) Fallback: direct REST call (PostgREST) with SRK to bypass any client quirk
    stage.where = "insert_rest_fallback";
    const restUrl = `${SUPABASE_URL}/rest/v1/Leads`;
    const restRes = await fetch(restUrl, {
      method: "POST",
      headers: {
        apikey: SRK,
        Authorization: `Bearer ${SRK}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ ...payload, provider_id: provider.id }]),
    });

    if (!restRes.ok) {
      const text = await restRes.text();
      return NextResponse.json(
        {
          ok: false,
          error: "Insert failed (REST)",
          status: restRes.status,
          details: text,
          first_try_details: leadErr?.message ?? null,
        },
        { status: 400 }
      );
    }

    const rows = await restRes.json();
    const rid = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
    return NextResponse.json({ ok: true, lead_id: rid ?? null, via: "rest" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error", where: (e && e.where) || "exception" },
      { status: 500 }
    );
  }
}
