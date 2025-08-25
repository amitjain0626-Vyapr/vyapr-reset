// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient as createSb } from "@supabase/supabase-js";

/**
 * POST /api/leads/create
 * Body:
 * {
 *   "slug": "amitjain0626",               // REQUIRED: provider microsite slug
 *   "patient_name": "Self Test",           // REQUIRED (min 1 char)
 *   "phone": "+9198xxxxxxxx",              // optional; normalized if present
 *   "note": "optional",                    // optional
 *   "source": { "utm": { ... } }           // optional JSON
 * }
 *
 * Behavior:
 * - Looks up Providers by slug (must exist & be published)
 * - Inserts into Leads with provider_id + supplied fields
 * - Returns { ok: true, lead_id, provider_slug }
 * - No migrations; RLS bypass via service role (server-only)
 */

function normalizePhone(raw?: string | null) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
  return `+${digits}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || "").trim();
    const patient_name = String(body?.patient_name || "").trim();
    const phone = normalizePhone(body?.phone ?? null);
    const note = body?.note ? String(body.note).slice(0, 500) : null;
    const source = (body?.source && typeof body.source === "object") ? body.source : {};

    if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    if (!patient_name) return NextResponse.json({ ok: false, error: "missing_patient_name" }, { status: 400 });

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "server_misconfigured_supabase" }, { status: 500 });
    }
    const admin = createSb(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) Resolve provider by slug (must be published to accept public leads)
    const { data: provider, error: pErr } = await admin
      .from("Providers")
      .select("id, slug, published")
      .eq("slug", slug)
      .maybeSingle();

    if (pErr) return NextResponse.json({ ok: false, error: "provider_lookup_failed", details: String(pErr.message || pErr) }, { status: 500 });
    if (!provider) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    if (provider.published === false) return NextResponse.json({ ok: false, error: "provider_unpublished" }, { status: 403 });

    // 2) Insert lead (minimal, migration-free columns only)
    const insertRow: any = {
      provider_id: provider.id,
      patient_name,
      phone,
      note,
      status: "new",
      source,                  // jsonb in most schemas; harmless if column absent (we’ll ignore error)
      created_at: new Date().toISOString(),
    };

    // Try insert with source; fallback to safe subset if column mismatch
    let leadId: string | null = null;
    {
      const { data, error } = await admin
        .from("Leads")
        .insert([insertRow])
        .select("id")
        .maybeSingle();

      if (error) {
        // Retry without source if schema lacks it
        const { data: d2, error: e2 } = await admin
          .from("Leads")
          .insert([{ ...insertRow, source: undefined }])
          .select("id")
          .maybeSingle();

        if (e2) {
          return NextResponse.json({ ok: false, error: "lead_insert_failed", details: String(e2.message || e2) }, { status: 500 });
        }
        leadId = d2?.id ?? null;
      } else {
        leadId = data?.id ?? null;
      }
    }

    // 3) Best-effort telemetry to Events (ignore failures)
    try {
      await admin.from("Events").insert([
        {
          type: "lead.created",
          provider_id: provider.id,
          lead_id: leadId,
          meta: { via: "api", slug, has_phone: Boolean(phone) },
          created_at: new Date().toISOString(),
        } as any,
      ]);
    } catch (_) {}

    return NextResponse.json({
      ok: true,
      provider_slug: provider.slug,
      lead_id: leadId,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
