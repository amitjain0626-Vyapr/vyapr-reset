// app/api/campaigns/autofire/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ----------------------------- lang helpers ------------------------------ */
/* No schema drift. English default. Honors: ?lang → cookie(vyapr.lang) → Providers.lang_pref → "en" */
type Lang = "en" | "hi";
function normalizeLangToken(v?: string | null): "en" | "hi" | "hinglish" | null {
  const t = (v || "").toLowerCase().trim();
  if (t === "en") return "en";
  if (t === "hi") return "hi";
  if (t === "hinglish") return "hinglish";
  return null;
}
async function resolveProviderLangPref(origin: string, slug: string): Promise<Lang | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${origin}/api/providers/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return normalizeLangToken(json?.lang_pref || json?.provider?.lang_pref);
  } catch {
    return null;
  }
}
async function resolveLang(req: NextRequest, slug: string): Promise<Lang> {
  const url = new URL(req.url);
  const qLang = normalizeLangToken(url.searchParams.get("lang"));
  if (qLang) return qLang;
  const cookieLang = normalizeLangToken(req.cookies.get("vyapr.lang")?.value);
  if (cookieLang) return cookieLang;
  const pref = await resolveProviderLangPref(url.origin, slug);
  return pref || "en";
}

/* --------------------------------- admin --------------------------------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveProviderId(
  sb: any,
  { provider_id, provider_slug }: { provider_id?: string | null; provider_slug?: string | null }
) {
  if (provider_id) return provider_id;
  if (!provider_slug) return null;
  const { data, error } = await sb.from("Providers").select("id").eq("slug", String(provider_slug).trim()).maybeSingle();
  if (error) return null;
  return data?.id || null;
}

function istNow() {
  const now = new Date();
  // IST = UTC+5:30
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return { nowUTC: now, nowIST: ist, hourIST: ist.getUTCHours() }; // hour 0-23 in IST
}

function withinNextHours(iso: string, hours = 12) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  return t > now && t <= now + hours * 60 * 60 * 1000;
}

function keyFor(rem: { lead_id?: string | null; slotISO?: string | null }) {
  return `${rem.lead_id || "null"}::${rem.slotISO || "null"}`;
}

/* ------------------------------- core logic ------------------------------ */
async function getNudgeConfig(origin: string, slug: string) {
  try {
    const res = await fetch(`${origin}/api/cron/nudges?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const json = await res.json();
    return {
      ok: !!json?.ok,
      provider_id: json?.provider_id || null,
      quiet_start: json?.config?.quiet_start ?? 22,
      quiet_end: json?.config?.quiet_end ?? 8,
      cap: json?.config?.cap ?? 25,
      remaining: json?.remaining ?? 0,
      is_quiet: !!json?.is_quiet,
      allowed: !!json?.allowed,
      windowHours: json?.windowHours ?? 12,
    };
  } catch {
    return { ok: false, provider_id: null, quiet_start: 22, quiet_end: 8, cap: 25, remaining: 0, is_quiet: true, allowed: false, windowHours: 12 };
  }
}

async function listCandidateSlotEvents(sb: any, provider_id: string) {
  // We consider any recent event that carries a slotISO as a "scheduled" signal:
  // booking.confirmed | lead.booked | payment.recorded | booking.reschedule.requested | booking.slot.selected
  const { data, error } = await sb
    .from("Events")
    .select("event, ts, provider_id, lead_id, source")
    .eq("provider_id", provider_id)
    .in("event", [
      "booking.confirmed",
      "lead.booked",
      "payment.recorded",
      "booking.reschedule.requested",
      "booking.slot.selected",
    ])
    .order("ts", { ascending: false })
    .limit(500);
  if (error) return [];
  return (data || []).filter((r: any) => r?.source?.slotISO);
}

async function listAlreadySent(sb: any, provider_id: string) {
  // Pull recently sent reminders to dedupe on (lead_id + slotISO)
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days
  const { data, error } = await sb
    .from("Events")
    .select("event, ts, lead_id, source")
    .eq("provider_id", provider_id)
    .eq("event", "wa.reminder.sent")
    .gt("ts", since)
    .order("ts", { ascending: false })
    .limit(1000);
  if (error) return new Set<string>();
  const keys = (data || []).map((r: any) => keyFor({ lead_id: r?.lead_id, slotISO: r?.source?.slotISO }));
  return new Set(keys);
}

async function logEvent_direct(
  sb: any,
  payload: { event: string; ts?: number; provider_id: string; lead_id?: string | null; source?: any }
) {
  const row = {
    event: payload.event,
    ts: payload.ts || Date.now(),
    provider_id: payload.provider_id,
    lead_id: payload.lead_id ?? null,
    source: typeof payload.source === "object" && payload.source !== null ? payload.source : {},
  };
  const { error } = await sb.from("Events").insert(row);
  if (error) throw new Error(error.message || "insert_failed");
}

/* -------------------------------- handlers ------------------------------- */
export async function POST(req: NextRequest) {
  const sb = admin();
  const url = new URL(req.url);
  const origin = url.origin;

  // Inputs
  const slug = (url.searchParams.get("slug") || "").trim();
  const test = url.searchParams.get("test") === "1"; // test mode passthrough
  const testLeadId = (url.searchParams.get("lead_id") || "").trim(); // optional in test mode

  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  // Decide language (for potential sends + telemetry)
  const lang = await resolveLang(req, slug);

  // Resolve provider
  const cfg = await getNudgeConfig(origin, slug);
  const provider_id = cfg?.provider_id || (await resolveProviderId(sb, { provider_slug: slug }));
  if (!provider_id) {
    return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });
  }

  // TEST MODE: always log one sample reminder (bypasses quiet hours/cap) for quick verification
  if (test) {
    const slotISO = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    await logEvent_direct(sb, {
      event: "wa.reminder.sent",
      provider_id,
      lead_id: testLeadId || null,
      source: {
        slotISO,
        channel: "whatsapp",
        template: "vyapr.default.reminder",
        mode: "test",
        lang, // record chosen language (allowed inside source)
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "test",
      provider_id,
      sent: 1,
      used_lead_id: testLeadId || null,
      slotISO,
      language: lang, // echo for verification
    });
  }

  // NORMAL MODE: respect quiet hours & daily cap
  if (!cfg.ok) {
    return NextResponse.json({ ok: false, error: "nudges_config_unavailable" }, { status: 503 });
  }
  if (!cfg.allowed) {
    return NextResponse.json({
      ok: true,
      allowed: false,
      reason: cfg.is_quiet ? "quiet_hours" : "cap_exhausted",
      remaining: cfg.remaining,
      sent: 0,
      language: lang, // echo for visibility
    });
  }

  // Build candidate list from Events carrying slotISO
  const candidates = await listCandidateSlotEvents(sb, provider_id);

  // Deduplicate against already sent
  const sentKeys = await listAlreadySent(sb, provider_id);

  // Filter for slots within next N hours & not yet sent
  const toSend: Array<{ lead_id: string | null; slotISO: string }> = [];
  for (const r of candidates) {
    const slotISO = String(r?.source?.slotISO || "");
    if (!slotISO) continue;
    if (!withinNextHours(slotISO, cfg.windowHours || 12)) continue; // only near-future
    const k = keyFor({ lead_id: r?.lead_id, slotISO });
    if (sentKeys.has(k)) continue; // already sent for this slot
    toSend.push({ lead_id: r?.lead_id ?? null, slotISO });
  }

  // Respect remaining cap
  const max = Math.max(0, Number(cfg.remaining || 0));
  const final = toSend.slice(0, max);

  // Log sends (Events only for MVP; WABA integration can attach provider creds later)
  let sent = 0;
  for (const item of final) {
    await logEvent_direct(sb, {
      event: "wa.reminder.sent",
      provider_id,
      lead_id: item.lead_id,
      source: {
        slotISO: item.slotISO,
        channel: "whatsapp",
        template: "vyapr.default.reminder",
        lang, // record chosen language
      },
    });
    sent++;
  }

  return NextResponse.json({
    ok: true,
    mode: "normal",
    provider_id,
    attempted: toSend.length,
    sent,
    remaining_after: Math.max(0, max - sent),
    window_hours: cfg.windowHours || 12,
    language: lang, // echo for visibility
  });
}

export async function GET(req: NextRequest) {
  // Health + quick help
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    route: "/api/campaigns/autofire",
    usage: {
      test: `${url.origin}/api/campaigns/autofire?slug=YOUR_SLUG&test=1&lead_id=OPTIONAL_LEAD_ID  (POST)`,
      normal: `${url.origin}/api/campaigns/autofire?slug=YOUR_SLUG  (POST)`,
    },
  });
}
