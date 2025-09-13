// app/api/journeys/pulse/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Prepare Morning Pulse (preview only) and log strict telemetry.
// Contract: {event, ts, provider_id, lead_id, source} ONLY
// Event: "journey.pulse.preview"
// No sends here. No schema drift. Insert-only surface for Habit & Pulse Spine.
// Verify (IST): 
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/pulse?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544"}'
// Pass: {"ok":true,"event":"journey.pulse.preview"} is present.
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
  const res = await fetch(
    `${base}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
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

    // Resolve provider_id (single source of truth)
    const provider_id = await resolveProviderId(req, slug);

    // Minimal preview payload (we will enrich in next rung using existing ROI/ORM APIs)
    // Keep text simple & category-agnostic for MVP preview
    const preview = {
      heading: "Morning Pulse",
      lines: [
        "Yesterday: 0 bookings · ₹0 collected",
        "7D trend: flat",
        "Pipeline: low — try a quick reactivation?",
      ],
      cta: "Reply ‘Yes’ to schedule a 7pm batch.",
    };

    // STRICT telemetry write (via internal API). Unlisted events are accepted with note.
    const payload = {
      event: "journey.pulse.preview",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: {
        via: "api.journeys.pulse",
        to,
        provider_slug: slug,
      },
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
      event: "journey.pulse.preview",
      provider_slug: slug,
      provider_id,
      to,
      preview, // purely informational
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "unexpected_error",
      detail: e?.message || String(e),
    });
  }
}
