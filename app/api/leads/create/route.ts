// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" } as const;
  }
  return {
    client: createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "vyapr/api/leads/create" } },
    }),
  } as const;
}

function normalizePhone(raw: string) {
  const s = (raw || "").trim();
  if (/^\d{10}$/.test(s)) return `+91${s}`;
  if (/^\+?\d{7,15}$/.test(s)) return s.startsWith("+") ? s : `+${s}`;
  return s;
}

async function fetchMicrositeBySlug(supabase: any, slug: string) {
  // use lowercase table name (your schema uses lowercase)
  return await supabase.from("microsites").select("*").eq("slug", slug).maybeSingle();
}

export async function POST(req: Request) {
  try {
    const { client: supabase, error: envErr } = getSupabaseServiceClient();
    if (envErr) {
      return NextResponse.json({ ok: false, error: envErr }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    // basic honeypot support (optional)
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ ok: true, skipped: true }, { status: 204 });
    }

    const slug = String(body.slug || "").trim();
    const patient_name = String(body.patient_name || "").trim();
    const phone = normalizePhone(String(body.phone || "").trim());
    const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";
    const utm = typeof body.utm === "object" && body.utm !== null ? body.utm : {};

    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    if (!patient_name) return NextResponse.json({ ok: false, error: "patient_name required" }, { status: 400 });
    if (!/^\+?\d{7,15}$/.test(phone)) return NextResponse.json({ ok: false, error: "invalid phone" }, { status: 400 });

    // 1) Load microsite
    const { data: site, error: siteErr } = await fetchMicrositeBySlug(supabase, slug);
    if (siteErr) return NextResponse.json({ ok: false, error: "microsite lookup failed", details: siteErr.message }, { status: 500 });
    if (!site) return NextResponse.json({ ok: false, error: "microsite not found" }, { status: 404 });

    // 2) Derive the provider id robustly (handles different column names)
    const providerId =
      site.provider_id ??
      site.owner_id ??
      site.dentist_id ??
      null;

    if (!providerId) {
      return NextResponse.json(
        { ok: false, error: "microsite not linked to a provider (missing provider_id/owner_id/dentist_id)", microsite: { id: site.id, slug: site.slug } },
        { status: 422 }
      );
    }

    // 3) Build payload aligned to your leads schema:
    //    - dentist_id is NOT NULL in your DB → set to providerId
    //    - owner_id exists in your DB → also set to providerId for consistency
    const payload = {
      dentist_id: providerId,
      owner_id: providerId,
      slug,
      patient_name,
      phone,
      note,
      utm,
      source: "microsite",
      status: "new",
    };

    // 4) Insert (your table name is lowercase "leads" per errors)
    const { data: inserted, error: insErr } = await supabase
      .from("leads")
      .insert(payload)
      .select()
      .maybeSingle();

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: "Insert failed", details: insErr.message, attempted_payload: payload },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled" }, { status: 500 });
  }
}
