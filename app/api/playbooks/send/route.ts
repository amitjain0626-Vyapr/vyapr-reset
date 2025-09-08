// app/api/playbooks/send/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// === VYAPR: Playbooks API START (22.18) ===
// POST /api/playbooks/send?slug=...
// Body: { lead_id: string, playbook: "reactivation" | "reminder" | "offer" }
// Logs telemetry row in Events table with STRICT contract:
// { event:"playbook.sent", ts(ms), provider_id, lead_id, source:{ playbook, via:"api.playbooks.send" } }
// No schema drift. Provider resolved via existing /api/providers/resolve.
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
  if (!url || !key) throw new Error("supabase_admin_env_missing");
  return { url, key };
}

function getAdminClient() {
  const { url, key } = getAdminEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveProviderId(req: NextRequest, slug: string) {
  // Prefer configured base; else derive from request headers
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const origin =
    envBase ||
    req.headers.get("origin") ||
    `https://${req.headers.get("host") || ""}`;
  const url = `${origin}/api/providers/resolve?slug=${encodeURIComponent(slug)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`provider_resolve_http_${res.status}`);
  const j = await res.json();
  if (!j?.ok || !j?.id) throw new Error("provider_resolve_invalid");
  return j.id as string;
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

    const provider_id = await resolveProviderId(req, slug);

    const supa = getAdminClient();
    const row = {
      event: "playbook.sent",
      ts: Date.now(),
      provider_id,
      lead_id, // nullable for broadcast/batch
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
      provider_id,
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
