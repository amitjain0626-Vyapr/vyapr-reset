// app/api/journeys/pulse/cancel/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Record provider cancel for today's 7pm reactivation batch.
// Event: "journey.pulse.cancelled" (telemetry-only)
// Inputs (POST):
//   /api/journeys/pulse/cancel?slug=...   body: { to:"+91...", when:"19:00", tz:"Asia/Kolkata" }
// Defaults: when="19:00", tz="Asia/Kolkata"
// Verify:
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/pulse/cancel?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544","when":"19:00","tz":"Asia/Kolkata"}'
// Pass: {"ok":true,"event":"journey.pulse.cancelled"} present.
// === KOREKKO<>Provider: Journeys (1.0) ===

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
  const res = await fetch(`${base}/api/providers/resolve?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
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
    const to = String(body?.to || "").trim() || null;
    const when = String(body?.when || "19:00").trim();
    const tz = String(body?.tz || "Asia/Kolkata").trim();

    const base = baseUrlFrom(req);
    const provider_id = await resolveProviderId(req, slug);

    const payload = {
      event: "journey.pulse.cancelled",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: {
        via: "api.journeys.pulse.cancel",
        to,
        provider_slug: slug,
        when,
        tz,
        action: "reactivation_batch_cancel",
      },
    };

    const tRes = await fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    if (!tRes.ok) {
      const detail = await tRes.text().catch(() => "");
      return json(500, { ok: false, error: "event_log_failed", detail });
    }

    return json(200, {
      ok: true,
      event: "journey.pulse.cancelled",
      provider_slug: slug,
      provider_id,
      to,
      when,
      tz,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "unexpected_error", detail: e?.message || String(e) });
  }
}
