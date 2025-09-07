// app/api/cron/nudges/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** --- helpers --- */
async function getProviderBySlug(slug: string) {
  if (!slug) return null;
  const { data } = await admin()
    .from("Providers")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data || null;
}

async function getLatestNudgeConfig(provider_id: string) {
  const { data = [] } = await admin()
    .from("Events")
    .select("event, ts, source")
    .eq("provider_id", provider_id)
    .eq("event", "nudge.config.updated")
    .order("ts", { ascending: false })
    .limit(1);

  const row = data[0];
  const src = (row?.source || {}) as any;
  const quiet_start = Number.isFinite(src.quiet_start) ? src.quiet_start : 22;
  const quiet_end = Number.isFinite(src.quiet_end) ? src.quiet_end : 8;
  const cap = Number.isFinite(src.cap) ? src.cap : 25;
  return { quiet_start, quiet_end, cap, updated_ts: row?.ts || null };
}

/** compute IST hour + start-of-day in IST (UTC ms) */
function computeIstClock(nowUtcMs: number) {
  const IST_OFFSET_MIN = 330; // +05:30
  const nowUtc = new Date(nowUtcMs);
  const minsUtc =
    nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + IST_OFFSET_MIN;
  const minsInDay = ((minsUtc % 1440) + 1440) % 1440;
  const istHour = Math.floor(minsInDay / 60);
  const startOfDayUtcMs = nowUtcMs - minsInDay * 60 * 1000;
  return { istHour, startOfDayUtcMs };
}

function isInQuiet(istHour: number, quiet_start: number, quiet_end: number) {
  // if start <= end: range in same day; else crosses midnight
  if (quiet_start <= quiet_end) return istHour >= quiet_start && istHour < quiet_end;
  return istHour >= quiet_start || istHour < quiet_end;
}

async function countSentToday(provider_id: string, sinceUtcMs: number) {
  const { count: c1 } = await admin()
    .from("Events")
    .select("event", { head: true, count: "exact" })
    .eq("provider_id", provider_id)
    .in("event", ["wa.reminder.sent", "nudge.sent"])
    .gte("ts", sinceUtcMs);
  return c1 || 0;
}

/** --- GET /api/cron/nudges?slug=amitjain0626 --- */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "missing slug", usage: "/api/cron/nudges?slug=<provider-slug>" },
      { status: 400 }
    );
  }

  const prov = await getProviderBySlug(slug);
  if (!prov?.id) {
    return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
  }

  const { quiet_start, quiet_end, cap, updated_ts } = await getLatestNudgeConfig(prov.id);
  const now = Date.now();
  const { istHour, startOfDayUtcMs } = computeIstClock(now);
  const sentToday = await countSentToday(prov.id, startOfDayUtcMs);

  const is_quiet = isInQuiet(istHour, quiet_start, quiet_end);
  const remaining = Math.max(0, cap - sentToday);
  const allowed = !is_quiet && remaining > 0;

  // (optional) telemetry: best-effort, non-blocking
  admin()
    .from("Events")
    .insert({
      event: "cron.checked",
      ts: now,
      provider_id: prov.id,
      lead_id: null,
      source: { istHour, quiet_start, quiet_end, cap, sentToday, remaining, allowed },
    })
    .then(() => {})
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    slug,
    provider_id: prov.id,
    now_ist_hour: istHour,
    config: { quiet_start, quiet_end, cap, updated_ts },
    sent_today: sentToday,
    remaining,
    is_quiet,
    allowed,
  });
}
