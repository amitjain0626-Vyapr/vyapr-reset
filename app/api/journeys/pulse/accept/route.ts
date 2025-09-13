// app/api/journeys/pulse/accept/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Record a provider's "Yes" to Morning Pulse → intent to run reactivation at 7pm.
// This step is TELEMETRY-ONLY to avoid schema drift. Next rung will wire actual scheduler.
// Event: "journey.pulse.accepted"
// Contract keys ONLY: {event, ts, provider_id, lead_id, source}
// Inputs (POST):
//   /api/journeys/pulse/accept?slug=...   body: { to:"+91...", when:"19:00", tz:"Asia/Kolkata" }
// Defaults: when="19:00", tz="Asia/Kolkata"
// Verify (use www until domain cutover):
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/pulse/accept?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544","when":"19:00","tz":"Asia/Kolkata"}'
// Pass: {"ok":true,"event":"journey.pulse.accepted"} present.
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
    const when = String(body?.when || "19:00").trim();           // 7pm default (IST)
    const tz = String(body?.tz || "Asia/Kolkata").trim();

    const base = baseUrlFrom(req);
    const provider_id = await resolveProviderId(req, slug);

    // STRICT telemetry — schedule INTENT ONLY (no writes beyond Events)
    const payload = {
      event: "journey.pulse.accepted",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: {
        via: "api.journeys.pulse.accept",
        to,
        provider_slug: slug,
        when,
        tz,
        action: "reactivation_batch_intent",
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
      event: "journey.pulse.accepted",
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
