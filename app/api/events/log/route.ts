// app/api/events/log/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

let createAdminClient: any;
async function getAdmin() {
  if (createAdminClient) return createAdminClient;
  try {
    ({ createAdminClient } = await import("@/lib/supabase/admin"));
  } catch {
    ({ createAdminClient } = await import("@/lib/supabaseAdmin"));
  }
  return createAdminClient;
}

// Try loading a server (RLS) client to read the authenticated user from cookies
let createServerClient: any;
async function getServer() {
  if (createServerClient) return createServerClient;
  try {
    // common paths in your repo
    ({ createClient: createServerClient } = await import("@/utils/supabase/server"));
  } catch {
    try {
      ({ createSupabaseServerClient: createServerClient } = await import("@/lib/supabase/server"));
    } catch {
      createServerClient = null;
    }
  }
  return createServerClient;
}

function bad(reqId: string, msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg, reqId }, { status: code });
}

// Soft allow-list — unknown events still insert, just annotated.
const ALLOW = new Set<string>([
  "booking.landing.opened",
  "wa.reminder.sent",
  "wa.reactivation.sent",
  "cron.checked",
  "cron.gha.ping",
  "nudge.config.updated",
  // Templates MVP
  "template.sent",
  "template.copied",
  // Batch-2 signals
  "auth.google.start",
  "auth.google.success",
  "lead.imported",
  "server.route.hit",
]);

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad(reqId, "Invalid JSON");
  }

  let { event, ts, provider_id, lead_id, source } = body || {};
  if (!event || typeof event !== "string") return bad(reqId, "Missing event");
  if (typeof ts !== "number" || !isFinite(ts)) ts = Date.now();
  if (!source || typeof source !== "object") source = {};

  try {
    const getAdminFactory = await getAdmin();
    const supaAdmin = getAdminFactory();

    // --- Resolve provider_id if absent ---
    // 1) From source.provider_slug (correct table: Providers)
    if (!provider_id && source?.provider_slug) {
      const slug = String(source.provider_slug || "").trim();
      if (slug) {
        const { data, error } = await supaAdmin
          .from("Providers")
          .select("id, created_at")
          .eq("slug", slug)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          provider_id = data[0].id;
        }
      }
    }

    // 2) From authenticated user (owner_id → Providers.id)
    if (!provider_id) {
      const getSrv = await getServer();
      if (getSrv) {
        try {
          const supaSrv = await getSrv();
          // try to read auth session from cookies
          const { data: auth } = await supaSrv.auth.getUser();
          const user = auth?.user || null;
          if (user?.id) {
            const { data: prov } = await supaAdmin
              .from("Providers")
              .select("id")
              .eq("owner_id", user.id)
              .maybeSingle();
            if (prov?.id) provider_id = prov.id;
          }
        } catch {}
      }
    }

    // 3) If still missing, hard error to respect NOT NULL on Events.provider_id
    if (!provider_id) {
      return bad(reqId, "provider_id_not_resolved");
    }

    const payload = [
      {
        event,
        ts,
        provider_id,
        lead_id: lead_id || null,
        source: ALLOW.has(event) ? source : { ...source, _note: "unlisted_event (accepted)" },
      },
    ];

    const { error: insErr } = await supaAdmin.from("Events").insert(payload);
    if (insErr) return bad(reqId, insErr.message, 500);

    return NextResponse.json({ ok: true, reqId });
  } catch (e: any) {
    return bad(reqId, e?.message || "Unexpected error", 500);
  }
}
