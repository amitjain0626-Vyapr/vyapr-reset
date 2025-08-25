// @ts-nocheck
import { NextResponse } from "next/server";

// Force Node runtime because we rely on cookies/session in Supabase server client.
export const runtime = "nodejs";

// If your project already has this helper, we use it.
// It should create a server-side Supabase client bound to Next.js cookies.
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Minimal, battle-tested telemetry logger for WhatsApp actions.
 * - Tries to insert into the "Events" table (append-only).
 * - If table/columns differ or insert fails, it safely falls back to console log.
 * - Never throws to the client: always returns { ok: true } so UI stays snappy.
 *
 * Expected body:
 * {
 *   type: "wa.reminder.sent" | "wa.rebook.sent",
 *   lead_id?: string | null,
 *   provider_id?: string | null,
 *   meta?: object
 * }
 */
export async function POST(req: Request) {
  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    // ignore
  }

  const type = String(payload?.type || "");
  const lead_id = payload?.lead_id ?? null;
  const provider_id = payload?.provider_id ?? null;
  const meta = payload?.meta ?? {};

  if (!type) {
    return NextResponse.json({ ok: false, error: "missing type" }, { status: 400 });
  }

  // Insert into Events (if table exists) with ultra-defensive guards.
  try {
    const supabase = await createSupabaseServerClient();

    // Shape is intentionally generic to avoid migrations:
    // Columns commonly present from our earlier steps: type, lead_id, provider_id, meta (jsonb), ts (default now()).
    const { data, error } = await supabase
      .from("Events")
      .insert([
        {
          type,
          lead_id,
          provider_id,
          meta: {
            ...meta,
            source: "dashboard.actions",
            channel: "whatsapp",
          },
          // If your table has extra columns, PostgREST will ignore missing ones with defaults.
          // If it errors, we catch below and fallback to console logging.
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      id: data?.id ?? null,
      stored: true,
    });
  } catch (e: any) {
    // Fallback: never break the UX. We still mark ok:true so buttons feel instant.
    console.log("[telemetry:fallback]", {
      type,
      lead_id,
      provider_id,
      meta,
      error: String(e?.message || e),
    });
    return NextResponse.json({ ok: true, stored: false, fallback: true });
  }
}
