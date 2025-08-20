// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server"; // keep your existing path

function cleanPhone(raw: string) {
  return (raw || "").replace(/[^0-9+]/g, "");
}
function trimOrNull(v: any) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const body = await req.json().catch(() => ({}));
    const slug = (body?.slug ?? "").toString().trim();
    const patient_name = trimOrNull(body?.patient_name);
    const phone = cleanPhone(body?.phone ?? "");
    const note = trimOrNull(body?.note);
    const source = body?.source ?? null;

    if (!slug || !patient_name || !phone) {
      return NextResponse.json(
        { ok: false, error: "Missing fields: slug, name, phone are required." },
        { status: 400 }
      );
    }

    // 1) Resolve provider (to build WhatsApp link + ensure published)
    const { data: provider, error: pErr } = await supabase
      .from("Providers")
      .select("id, display_name, whatsapp, phone, slug, published")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json(
        { ok: false, error: `Provider lookup failed: ${pErr.message}` },
        { status: 500 }
      );
    }
    if (!provider?.id) {
      return NextResponse.json(
        { ok: false, error: "Provider not found or not published." },
        { status: 404 }
      );
    }

    // 2) Insert via SECURITY DEFINER RPC (bypasses RLS, but checks are inside)
    const { data: newId, error: rpcErr } = await supabase.rpc(
      "public_insert_lead_by_slug",
      {
        p_slug: slug,
        p_patient_name: patient_name,
        p_phone: phone,
        p_note: note,
        p_source: source,
      }
    );

    if (rpcErr) {
      return NextResponse.json(
        { ok: false, error: `Could not save lead: ${rpcErr.message}` },
        { status: 400 }
      );
    }

    // 3) Build WhatsApp fallback URL
    const waNumber = cleanPhone(provider.whatsapp || provider.phone || "");
    const providerName = provider.display_name ? ` ${provider.display_name}` : "";
    const text = encodeURIComponent(`Hi${providerName}, I’d like to book a slot.`);
    const whatsapp_url = waNumber
      ? `https://wa.me/${waNumber.replace(/^\+/, "")}?text=${text}`
      : null;

    return NextResponse.json({
      ok: true,
      id: newId, // uuid returned by the RPC
      provider_slug: provider.slug,
      whatsapp_url,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
