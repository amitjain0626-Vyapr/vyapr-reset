// app/api/leads/create/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = cookies();
  const hdrs = headers();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { get: (n: string) => cookieStore.get(n)?.value },
      headers: { get: (n: string) => hdrs.get(n) ?? undefined },
    }
  );

  try {
    const body = await req.json();
    const { slug, patient_name, phone, note, source } = body || {};
    if (!slug || !phone) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    // SECURITY DEFINER RPC enforces Providers.published=true and bypasses RLS for public insert
    const { data, error } = await supabase.rpc("public_insert_lead_by_slug", {
      p_slug: slug,
      p_patient_name: patient_name ?? null,
      p_phone: phone,
      p_note: note ?? null,
      p_source: source ?? {},
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    // Normalize RPC response shapes
    const lead = data?.lead || data;
    const provider_slug = data?.provider_slug || slug;
    const provider_id = data?.provider_id || lead?.provider_id || null;
    const id = lead?.id || data?.id;

    // --- Unconditional console telemetry (always visible in Vercel runtime logs) ---
    try {
      console.log(
        "[telemetry] " +
          JSON.stringify({
            event: "lead.created",
            ts: Date.now(),
            provider_id,
            provider_slug,
            lead_id: id,
            source: source ?? {},
          })
      );
    } catch {}

    // Also fire the logger shim (non-blocking). Same-origin '' works if BASE_URL not set.
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead.created",
          ts: Date.now(),
          provider_id,
          provider_slug,
          lead_id: id,
          source: source ?? {},
        }),
        cache: "no-store",
      });
    } catch {}

    // WhatsApp URL passthrough if RPC returns it
    const whatsapp_url =
      data?.whatsapp_url ||
      (source?.wa && typeof source.wa === "string" ? source.wa : undefined);

    return NextResponse.json({ ok: true, id, provider_slug, whatsapp_url });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
}
