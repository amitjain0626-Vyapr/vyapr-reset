// app/api/slots/alerts/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- admin ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function j(body: any, code = 200) {
  return NextResponse.json(body, {
    status: code,
    headers: { "Cache-Control": "no-store" },
  });
}

/* ---------- helpers ---------- */
const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

async function resolveProvider(slug: string) {
  try {
    const r = await fetch(
      `${ORIGIN}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => null);
    if (!j?.ok || !j?.id) return null;
    return j; // { ok, id, slug, display_name, profession, category }
  } catch {
    return null;
  }
}

/** Try multiple shapes so we don't 500 if resolver changes */
function extractOpenSlots(payload: any): number {
  if (!payload) return 0;
  // Common shapes we already expose elsewhere
  // 1) { ok, slots: [{start,end,isOpen:true}, ...] }
  if (Array.isArray(payload.slots)) {
    const arr = payload.slots.filter((s: any) => s?.isOpen !== false);
    return arr.length;
  }
  // 2) { ok, data: { slots: [...] } }
  if (payload.data?.slots && Array.isArray(payload.data.slots)) {
    const arr = payload.data.slots.filter((s: any) => s?.isOpen !== false);
    return arr.length;
  }
  // 3) { ok, open_count: n }
  if (Number.isFinite(payload.open_count)) return Number(payload.open_count);
  // 4) { ok, open: n }
  if (Number.isFinite(payload.open)) return Number(payload.open);
  return 0;
}

async function fetchAvailability(slug: string) {
  // Prefer the dedicated availability resolver if present.
  const urls = [
    `${ORIGIN}/api/availability/resolve?slug=${encodeURIComponent(slug)}`,
    `${ORIGIN}/api/debug/slots?slug=${encodeURIComponent(slug)}`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (j) return j;
    } catch {}
  }
  return null;
}

/* ---------- telemetry ---------- */
async function logEvent(req: NextRequest, payload: any) {
  try {
    const r = await fetch(new URL("/api/events/log", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* ---------- GET ---------- */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  const dry = url.searchParams.get("dry") === "1"; // optional, suppress send side-effects

  if (!slug) return j({ ok: false, error: "missing slug" }, 400);

  const provider = await resolveProvider(slug);
  if (!provider?.id) return j({ ok: false, error: "provider_not_found" }, 404);

  const availability = await fetchAvailability(slug);
  const openCount = extractOpenSlots(availability);
  const hasOpenSlots = openCount > 0;

  // If slots exist, no alert — just return status
  if (hasOpenSlots) {
    return j({
      ok: true,
      slug,
      provider_id: provider.id,
      has_open_slots: true,
      open_count: openCount,
      note: "No alert needed",
    });
  }

  // Build an actionable message + link for provider
  const meetingLink = `${ORIGIN}/settings/meeting?slug=${encodeURIComponent(slug)}`;
  const copy = [
    `Heads up — customers couldn't find an available slot for ${provider.display_name || slug}.`,
    `Add or extend slots to capture these bookings: ${meetingLink}`,
  ].join("\n");

  const adminClient = admin();
  const now = Date.now();

  // Log telemetry: slot.alert.sent (strict schema)
  const payload = {
    event: "slot.alert.sent",
    ts: now,
    provider_id: provider.id,
    lead_id: null,
    source: {
      via: "slots.alerts",
      provider_slug: slug,
      open_count: openCount,
      dry_run: dry,
    },
  };

  // Only log if not dry-run
  const logged = dry ? true : await logEvent(req, payload);

  // Optional: store last_alert_ts on Providers if that column exists (best-effort, no fail)
  try {
    // Fail-open: update only if column exists
    await adminClient
      .from("Providers")
      .update({ last_slot_alert_ts: now })
      .eq("id", provider.id);
  } catch {}

  return j({
    ok: true,
    slug,
    provider_id: provider.id,
    has_open_slots: false,
    open_count: openCount,
    alert: {
      sent: !!logged && !dry,
      ts: now,
      channel: "inapp",
      message: copy,
      manage_url: meetingLink,
    },
  });
}
