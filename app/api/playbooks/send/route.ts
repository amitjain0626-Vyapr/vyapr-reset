// app/api/playbooks/send/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// === VYAPR: Playbooks API START (22.18) ===
// POST /api/playbooks/send?slug=...
// Body: { lead_id: string, playbook: "reactivation" | "reminder" | "offer" }
// Logs telemetry: {event:"playbook.sent", ts, provider_id, lead_id, source:{playbook, via:"api.playbooks.send"}}
// No schema drift. Only inserts a row in events.
// === VYAPR: Playbooks API END (22.18) ===

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function getAdminEnv() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";
  if (!url || !key) {
    throw new Error("supabase_admin_env_missing");
  }
  return { url, key };
}

function getAdminClient() {
  const { url, key } = getAdminEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return json(400, { ok: false, error: "missing_slug" });

    const body = (await req.json().catch(() => ({}))) || {};
    const lead_id =
      typeof body?.lead_id === "string" && body.lead_id.trim()
        ? body.lead_id.trim()
        : null;
    const playbook = String(body?.playbook || "reactivation")
      .toLowerCase()
      .trim();

    const supa = getAdminClient();

    // Resolve provider by slug (owner/public-safe via admin)
    const { data: provider, error: provErr } = await supa
      .from("providers")
      .select("id, slug, published")
      .eq("slug", slug)
      .single();

    if (provErr)
      return json(500, {
        ok: false,
        error: "provider_lookup_failed",
        detail: provErr.message,
      });

    if (!provider || provider.published === false) {
      return json(404, {
        ok: false,
        error: "provider_not_found_or_unpublished",
      });
    }

    const row = {
      event: "playbook.sent",
      ts: Date.now(),
      provider_id: provider.id,
      lead_id, // can be null for broadcast/batch
      source: { playbook, via: "api.playbooks.send" },
    };

    const { error: insErr } = await supa.from("events").insert(row);
    if (insErr)
      return json(500, {
        ok: false,
        error: "event_insert_failed",
        detail: insErr.message,
      });

    return json(200, {
      ok: true,
      event: "playbook.sent",
      provider_slug: slug,
      lead_id,
      playbook,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "unexpected_error",
      detail: e?.message || String(e),
    });
  }
}
