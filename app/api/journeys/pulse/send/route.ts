// app/api/journeys/pulse/send/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Send Morning Pulse over WA using existing infra (/api/wa/send).
// Flow:
//  1) Compose preview via /api/journeys/pulse/compose (single source).
//  2) Build a clean text message.
//  3) Call /api/wa/send {to, text}.
//  4) Log STRICT telemetry: {event:"journey.pulse.sent", ts, provider_id, lead_id:null, source:{via, to, provider_slug}}.
// Inputs: POST /api/journeys/pulse/send?slug=...  body: { to:"+91..." }
// No schema/name drift. Insert-only.
// Verify (use www until domain cutover):
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/pulse/send?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544"}'
// Pass: {"ok":true,"event":"journey.pulse.sent"}.
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

function buildText(preview: any) {
  const heading = preview?.heading ? String(preview.heading) : "Morning Pulse";
  const lines: string[] = Array.isArray(preview?.lines) ? preview.lines.map((x: any) => String(x)) : [];
  const cta = preview?.cta ? String(preview.cta) : "";
  const bullet = lines.length ? "\n- " + lines.join("\n- ") : "";
  const tail = cta ? `\n\n${cta}` : "";
  return `${heading}${bullet}${tail}`;
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return json(400, { ok: false, error: "missing_slug" });

    const body = (await req.json().catch(() => ({}))) || {};
    const to = String(body?.to || "").trim();
    if (!to) return json(400, { ok: false, error: "missing_to" });

    const base = baseUrlFrom(req);
    const provider_id = await resolveProviderId(req, slug);

    // 1) Compose from our previous rung
    const compRes = await fetch(`${base}/api/journeys/pulse/compose?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ to }),
    });
    if (!compRes.ok) {
      const detail = await compRes.text().catch(() => "");
      return json(502, { ok: false, error: "compose_failed", detail });
    }
    const composed = await compRes.json();
    const text = buildText(composed?.preview || {});

    // 2) Send via existing WA endpoint
    const waRes = await fetch(`${base}/api/wa/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ to, text }),
    });
    if (!waRes.ok) {
      const detail = await waRes.text().catch(() => "");
      return json(502, { ok: false, error: "wa_send_failed", detail });
    }
    const wa = await waRes.json().catch(() => ({}));

    // 3) STRICT telemetry
    const telemetry = {
      event: "journey.pulse.sent",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: {
        via: "api.journeys.pulse.send",
        to,
        provider_slug: slug,
      },
    };
    const tRes = await fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(telemetry),
    });
    if (!tRes.ok) {
      const detail = await tRes.text().catch(() => "");
      return json(500, { ok: false, error: "event_log_failed", detail });
    }

    return json(200, {
      ok: true,
      event: "journey.pulse.sent",
      provider_slug: slug,
      provider_id,
      to,
      wa, // passthrough response from /api/wa/send (opaque; for debugging only)
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "unexpected_error", detail: e?.message || String(e) });
  }
}
