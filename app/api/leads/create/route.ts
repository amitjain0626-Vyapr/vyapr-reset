// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

/**
 * Creates a lead for a public microsite booking.
 * - Uses admin client to bypass RLS safely for this endpoint.
 * - Inserts WITHOUT owner_id first (most schemas don't need it here).
 * - If FK demands owner_id, retries mapping to provider.id.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot
    if (typeof body.website === "string" && body.website.trim()) {
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

    // Normalize phone (+91 if 10 digits)
    const digits = phone_raw.replace(/[^\d+]/g, "");
    const phone =
      /^\d{10}$/.test(digits) ? `+91${digits}` :
      /^\+?\d{7,15}$/.test(digits) ? (digits.startsWith("+") ? digits : `+${digits}`) :
      null;

    if (!phone) {
      return NextResponse.json({ ok: false, error: "Invalid phone format" }, { status: 400 });
    }

    // Find provider by slug
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

    // Base payload (no owner_id)
    const basePayload = {
      dentist_id: provider.id,      // provider.id == dentist_id in our mapping
      source_slug: slug,
      slug,                         // keep if your table has this column
      patient_name,
      phone,
      note,
      utm,
      source: "microsite",
      status: "new",
    };

    // 1) Try insert WITHOUT owner_id
    let insert = await supabaseAdmin
      .from("leads")
      .insert([basePayload])
      .select()
      .single();

    // 2) If FK complains about owner, retry with owner_id = provider.id (fallback schema)
    if (insert.error && /owner/i.test(insert.error.message)) {
      const retryPayload = { ...basePayload, owner_id: provider.id };
      insert = await supabaseAdmin
        .from("leads")
        .insert([retryPayload])
        .select()
        .single();

      if (insert.error) {
        return NextResponse.json(
          { ok: false, error: "Insert failed", details: insert.error.message, attempted_payload: retryPayload },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, lead: insert.data }, { status: 201 });
    }

    if (insert.error) {
      return NextResponse.json(
        { ok: false, error: "Insert failed", details: insert.error.message, attempted_payload: basePayload },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead: insert.data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Server error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
