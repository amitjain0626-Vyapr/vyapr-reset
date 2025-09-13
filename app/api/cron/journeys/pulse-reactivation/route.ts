// app/api/cron/journeys/pulse-reactivation/route.ts
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Execute reactivation batch for providers who accepted "Yes" in Morning Pulse.
// Reads Events (journey.pulse.accepted) for today (IST), skips if a cancel exists today,
// triggers /api/playbooks/send (playbook:"reactivation"), logs journey.pulse.executed.
// Idempotent: skips if already executed today.
// Verify (manual; force bypasses time window):
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/cron/journeys/pulse-reactivation?force=1" \
//     -H "Content-Type: application/json"
// Pass: {"ok":true,...} with results entries (executed/skipped_*).
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

async function getAdmin() {
  try {
    const mod = await import("@/lib/supabase/admin");
    return mod.createAdminClient();
  } catch {
    const mod = await import("@/lib/supabaseAdmin");
    return mod.createAdminClient();
  }
}

function istDayBounds(date = new Date()) {
  const opts: any = { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" };
  const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(date);
  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const d = parts.find(p => p.type === "day")?.value ?? "01";
  const startIst = new Date(`${y}-${m}-${d}T00:00:00+05:30`).getTime();
  const endIst = startIst + 24 * 60 * 60 * 1000;
  return { startIst, endIst };
}

function isWithin19WindowIST(now = new Date(), windowMin = 15) {
  const fmt: any = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const hh = Number(fmt.find(p => p.type === "hour")?.value ?? "00");
  const mm = Number(fmt.find(p => p.type === "minute")?.value ?? "00");
  if (hh !== 19) return false;
  return mm >= 0 && mm <= windowMin;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = (searchParams.get("force") || "").trim() === "1";

  try {
    const base = baseUrlFrom(req);
    const supa = await getAdmin();

    const now = new Date();
    const { startIst, endIst } = istDayBounds(now);
    const withinWindow = isWithin19WindowIST(now, 15);
    if (!force && !withinWindow) {
      return json(200, {
        ok: true,
        status: "skipped_time_window",
        info: "Not in 19:00 IST window; use ?force=1 to run anyway",
      });
    }

    // Read today's ACCEPTED intents
    const { data: accepted, error: accErr } = await supa
      .from("Events")
      .select("id, ts, provider_id, source")
      .eq("event", "journey.pulse.accepted")
      .gte("ts", startIst)
      .lt("ts", endIst)
      .order("ts", { ascending: true });
    if (accErr) return json(500, { ok: false, error: "read_accepted_failed", detail: accErr.message });

    const results: any[] = [];

    for (const row of accepted || []) {
      const provider_id = row.provider_id;
      const src = (row.source || {}) as any;
      const when = String(src.when || "19:00");
      const tz = String(src.tz || "Asia/Kolkata").trim();
      const slug = String(src.provider_slug || "").trim();

      // window/param guard
      if (!force) {
        if (tz !== "Asia/Kolkata") { results.push({ provider_id, slug, skipped: "tz_mismatch" }); continue; }
        if (when !== "19:00") { results.push({ provider_id, slug, skipped: "when_mismatch" }); continue; }
      }

      // Skip if a CANCEL exists today
      const { data: cancelled } = await supa
        .from("Events")
        .select("id")
        .eq("event", "journey.pulse.cancelled")
        .eq("provider_id", provider_id)
        .gte("ts", startIst)
        .lt("ts", endIst)
        .limit(1);
      if (cancelled && cancelled.length > 0) {
        results.push({ provider_id, slug, skipped: "cancelled_today" });
        continue;
      }

      // Idempotency: skip if already executed today
      const { data: executed } = await supa
        .from("Events")
        .select("id")
        .eq("event", "journey.pulse.executed")
        .eq("provider_id", provider_id)
        .gte("ts", startIst)
        .lt("ts", endIst)
        .limit(1);
      if (executed && executed.length > 0) {
        results.push({ provider_id, slug, skipped: "already_executed" });
        continue;
      }

      // Trigger playbook
      const sendRes = await fetch(`${base}/api/playbooks/send?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ lead_id: null, playbook: "reactivation" }),
      });
      if (!sendRes.ok) {
        const detail = await sendRes.text().catch(() => "");
        results.push({ provider_id, slug, ok: false, error: "playbook_send_failed", detail });
        continue;
      }

      // Log executed
      const telemetry = {
        event: "journey.pulse.executed",
        ts: Date.now(),
        provider_id,
        lead_id: null,
        source: {
          via: "api.cron.journeys.pulse-reactivation",
          provider_slug: slug,
          when,
          tz,
          action: "reactivation_batch_execute",
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
        results.push({ provider_id, slug, ok: false, error: "event_log_failed", detail });
        continue;
      }

      results.push({ ok: true, event: "journey.pulse.executed", provider_id, slug });
    }

    return json(200, { ok: true, results });
  } catch (e: any) {
    return json(500, { ok: false, error: "unexpected_error", detail: e?.message || String(e) });
  }
}
