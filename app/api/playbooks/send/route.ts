// app/api/playbooks/send/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === VYAPR: Playbooks API START (22.18) ===
// POST /api/playbooks/send?slug=...
// Body: { lead_id?: string|null, playbook?: "reactivation" | "reminder" | "offer" }
// Logs STRICT telemetry via internal API (/api/events/log), not direct DB insert.
// Contract ONLY: {event, ts(ms), provider_id, lead_id, source:{playbook, via:"api.playbooks.send"}}
// Provider resolved via /api/providers/resolve (single source of truth).
// UUID guard: non-UUID lead_id is coerced to null to satisfy DB type.
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
  const res = await fetch(
    `${base}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`provider_resolve_http_${res.status}`);
  const j = await res.json();
  if (!j?.ok || !j?.id) throw new Error("provider_resolve_invalid");
  return j.id as string;
}

function asUuidOrNull(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  // very permissive UUID v4/v1 matcher (xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const uuid36 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return uuid36.test(s) ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return json(400, { ok: false, error: "missing_slug" });

    const body = (await req.json().catch(() => ({}))) || {};
    const lead_id = asUuidOrNull(body?.lead_id);
    const playbook = String(body?.playbook || "reactivation").toLowerCase().trim();

    const provider_id = await resolveProviderId(req, slug);

    const payload = {
      event: "playbook.sent",
      ts: Date.now(),
      provider_id,
      lead_id, // may be null (batch mode or non-UUID input)
      source: { playbook, via: "api.playbooks.send" },
    };

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
