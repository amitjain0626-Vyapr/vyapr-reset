// app/api/journeys/pulse/compose/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Compose a *real* Morning Pulse preview from existing APIs.
// Inputs: POST /api/journeys/pulse/compose?slug=...  body: { to?: "+91..." }
// Data sources (read-only): /api/roi/summary, /api/roi/pending, /api/slots/alerts
// Telemetry: {event:"journey.pulse.composed", ts, provider_id, lead_id:null, source:{via, to, provider_slug}}
// No WA send here. No schema drift. Insert-only for safe iteration.
// Verify (use www until korekko.com cutover):
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/pulse/compose?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544"}'
// Pass: {"ok":true,"event":"journey.pulse.composed"} present.
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

async function safeGet(base: string, path: string) {
  try {
    const r = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function currency(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return json(400, { ok: false, error: "missing_slug" });

    const body = (await req.json().catch(() => ({}))) || {};
    const to = String(body?.to || "").trim() || null;

    const base = baseUrlFrom(req);
    const provider_id = await resolveProviderId(req, slug);

    // --- Fetch live data (best-effort, resilient fallbacks) ---
    const [roiSummary, roiPending, slotsAlerts] = await Promise.all([
      safeGet(base, `/api/roi/summary?slug=${encodeURIComponent(slug)}`),
      safeGet(base, `/api/roi/pending?slug=${encodeURIComponent(slug)}`),
      safeGet(base, `/api/slots/alerts?slug=${encodeURIComponent(slug)}`),
    ]);

    // Derive simple pulse lines with safe fallbacks
    const yesterdayBookings = roiSummary?.yesterday?.bookings ?? 0;
    const yesterdayRevenue = roiSummary?.yesterday?.collected ?? 0;

    // trend: prefer 7D delta% if present
    let trendText = "flat";
    const d7 = roiSummary?.trend7d ?? null;
    if (d7 && typeof d7.deltaPct === "number") {
      const pct = Math.round(d7.deltaPct);
      trendText = pct > 0 ? `+${pct}%` : `${pct}%`;
    }

    // pipeline: pending ₹ + count
    const pendCount = roiPending?.count ?? 0;
    const pendAmount = roiPending?.amount ?? 0;

    // slot alerts: next risky date or low-capacity hint
    const nextAlert = Array.isArray(slotsAlerts?.items) && slotsAlerts.items.length > 0 ? slotsAlerts.items[0] : null;
    const slotLine = nextAlert?.message || "No slot risks flagged.";

    const preview = {
      heading: "Morning Pulse",
      lines: [
        `Yesterday: ${yesterdayBookings} bookings · ${currency(yesterdayRevenue)} collected`,
        `7D trend: ${trendText}`,
        `Pipeline: ${pendCount} pending · ${currency(pendAmount)}`,
        slotLine,
      ],
      cta: "Reply ‘Yes’ to schedule a 7pm reactivation batch.",
    };

    // STRICT telemetry write
    const telemetry = {
      event: "journey.pulse.composed",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: { via: "api.journeys.pulse.compose", to, provider_slug: slug },
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
      event: "journey.pulse.composed",
      provider_slug: slug,
      provider_id,
      to,
      preview,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: "unexpected_error", detail: e?.message || String(e) });
  }
}
