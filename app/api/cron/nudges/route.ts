// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient as createSb } from "@supabase/supabase-js";

/**
 * Body expected from client:
 * {
 *   name: "wa.reminder.sent" | "wa.rebook.sent" | ...,
 *   payload: {
 *     provider_slug?: string,          // preferred (we'll resolve to provider_id)
 *     provider_id?: string,            // optional direct id
 *     lead_id?: string,                // optional
 *     ...any other context (will go to 'source')
 *   }
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body?.name || "").trim();
    const payload = body?.payload ?? {};
    if (!event) return NextResponse.json({ ok: false, error: "missing name" }, { status: 400 });

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
    }
    const admin = createSb(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Resolve provider_id
    let provider_id: string | null = null;
    if (payload?.provider_id) {
      provider_id = String(payload.provider_id);
    } else if (payload?.provider_slug) {
      const { data: p } = await admin
        .from("Providers")
        .select("id")
        .eq("slug", String(payload.provider_slug))
        .maybeSingle();
      provider_id = p?.id || null;
    }

    // If provider_id is still missing, we cannot write (NOT NULL)
    if (!provider_id) {
      // Don't fail the UX; just acknowledge with wrote:0
      return NextResponse.json({ ok: true, wrote: 0, note: "missing provider_id/provider_slug" });
    }

    const row = {
      event,
      ts: Date.now(),               // ms epoch
      provider_id,
      lead_id: payload?.lead_id ?? null, // nullable
      source: payload || {},        // your table accepts NOT NULL; we send object
    };

    const r = await admin.from("Events").insert([row]).select("event");
    if (r.error) {
      return NextResponse.json({ ok: false, error: String(r.error.message || r.error) }, { status: 200 });
    }
    return NextResponse.json({ ok: true, wrote: (r.data || []).length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
