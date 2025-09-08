// app/api/playbooks/send/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === VYAPR: Playbooks API START (22.18) ===
// POST /api/playbooks/send?slug=...
// Body: { lead_id: string|null, playbook: "reactivation" | "reminder" | "offer" }
// Logs STRICT telemetry via internal API (/api/events/log), not direct DB insert.
// Contract fields ONLY: {event, ts(ms), provider_id, lead_id, source:{playbook,...}}
// Provider is resolved via /api/providers/resolve to fetch provider_id safely.
// === VYAPR: Playbooks API END (22.18) ===

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function baseUrlFrom(req: NextRequest) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (envBase) return envBase;
  const host = req.headers.get("host") || "";
  return `https://${host}`;
}

async function resolveProviderId(req: NextRequest, slug: string) {
  const base = baseUrlFrom(req);
  const res = await fetch(`${base}/api/providers/resolve?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
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
    const playbook = String(body?.playbook || "reactivation").toLowerCase().trim();

    // Resolve provider_id via canonical resolver
    const provider_id = await resolveProviderId(req, slug);

    // Build STRICT telemetry payload (no schema drift)
    const payload = {
      event: "playbook.sent",
      ts: Date.now(),
      provider_id,
      lead_id, // nullable in batch mode
      source: { playbook, via: "api.playbooks.send" },
    };

    // Delegate append to existing internal API (avoids direct table/schema coupling)
    const base = baseUrlFrom(req);
    const res = await fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json(500, { ok: false, error: "event_log_failed", detail });
    }

    // Return minimal success with echoed context
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
