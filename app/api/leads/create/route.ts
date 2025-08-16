// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    client: createClient(url!, serviceKey!, {
      auth: { persistSession: false },
    }),
  };
}

function normalizePhone(raw: string) {
  const s = (raw || "").trim();
  if (/^\d{10}$/.test(s)) return `+91${s}`;
  if (/^\+?\d{7,15}$/.test(s)) return s.startsWith("+") ? s : `+${s}`;
  return s;
}

async function fetchMicrositeBySlug(supabase: any, slug: string) {
  const { data, error } = await supabase.from("microsites").select("*").eq("slug", slug).maybeSingle();
  return { data, error };
}

export async function POST(req: Request) {
  try {
    const { client: supabase } = getSupabaseServiceClient();
    const json = await req.json();

    const slug = String(json.slug || "").trim();
    const patient_name = String(json.patient_name || "").trim();
    const phone = normalizePhone(json.phone || "");
    const note = json.note || "";
    const utm = json.utm || {};

    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });

    // find microsite
    const { data: site } = await fetchMicrositeBySlug(supabase, slug);
    if (!site) return NextResponse.json({ ok: false, error: "microsite not found" }, { status: 404 });

    const owner_id = site.owner_id ?? site.provider_id ?? null;
    if (!owner_id) return NextResponse.json({ ok: false, error: "no owner_id" }, { status: 422 });

    const payload = {
      owner_id,
      dentist_id: owner_id,   // ✅ map provider → dentist_id
      slug,
      patient_name,
      phone,
      note,
      utm,
      source: "microsite",
      status: "new",
    };

    const { data: inserted, error } = await supabase.from("leads").insert(payload).select().maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: "Insert failed", details: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, lead: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
