// app/api/provider/update/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// STRICT: We only ever touch existing columns on the existing "Providers" table.
// Columns referenced: id, slug, display_name, profession, category.

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function bad(json: any, status = 400) {
  return ok({ ok: false, ...json }, status);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    url.origin ||
    "https://vyapr-reset-5rly.vercel.app";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return bad({ error: "invalid_json_body" }, 400);
  }

  const slug = (body?.slug || "").toString().trim();
  const display_name = body?.display_name != null ? String(body.display_name) : undefined;
  const profession = body?.profession != null ? String(body.profession) : undefined;
  const category = body?.category != null ? String(body.category) : undefined;

  if (!slug) {
    return bad({ error: "missing_slug" }, 400);
  }
  if (display_name === undefined && profession === undefined && category === undefined) {
    return bad({ error: "nothing_to_update" }, 400);
  }

  // Use service role to bypass RLS for admin updates (no schema drift).
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return bad({ error: "server_misconfigured_supabase_env" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Build update payload ONLY with provided fields
  const patch: any = {};
  if (display_name !== undefined) patch.display_name = display_name;
  if (profession !== undefined) patch.profession = profession;
  if (category !== undefined) patch.category = category;

  // Update by slug
  const { data, error } = await supabase
    .from("Providers")
    .update(patch)
    .eq("slug", slug)
    .select("id, slug, display_name, profession, category")
    .limit(1);

  if (error) {
    // Log the failure (best-effort) and return
    try {
      await fetch(`${origin}/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "provider.profile.update_failed",
          ts: Date.now(),
          provider_id: null,
          lead_id: null,
          source: { via: "api.provider.update", slug, error: error.message },
        }),
      });
    } catch {}
    return bad({ error: "supabase_update_failed", detail: error.message }, 500);
  }

  const row = Array.isArray(data) ? data[0] : null;

  // Telemetry (best-effort)
  try {
    await fetch(`${origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "provider.profile.updated",
        ts: Date.now(),
        provider_id: row?.id || null,
        lead_id: null,
        source: {
          via: "api.provider.update",
          slug,
          touched: Object.keys(patch),
        },
      }),
    });
  } catch {}

  return ok({ ok: true, row });
}
