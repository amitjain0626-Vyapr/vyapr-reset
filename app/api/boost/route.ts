// app/api/boost/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- helpers ---------- */
const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function j(body: any, code = 200) {
  return NextResponse.json(body, {
    status: code,
    headers: { "Cache-Control": "no-store" },
  });
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

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

/* ---------- POST = purchase / expire (for testing) ---------- */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  const expire = url.searchParams.get("expire") === "1"; // test hook

  if (!slug) return j({ ok: false, error: "missing slug" }, 400);

  const p = await resolveProvider(slug);
  if (!p?.id) return j({ ok: false, error: "provider_not_found" }, 404);

  const now = Date.now();
  const cycleMs = 30 * 24 * 60 * 60 * 1000; // 30d
  const until = expire ? now : now + cycleMs;

  // telemetry (strict schema)
  const eventName = expire ? "boost.slot.expired" : "boost.slot.purchased";
  await logEvent(req, {
    event: eventName,
    ts: now,
    provider_id: p.id,
    lead_id: null,
    source: {
      via: "boost.api",
      slug,
      cycle_days: 30,
      testing_expire: expire,
    },
  });

  // best-effort: persist a flag/window if column exists (fail-open)
  try {
    await admin()
      .from("Providers")
      .update({
        boost_until_ts: until, // only has effect if column exists
        boost_enabled: !expire, // only has effect if column exists
      })
      .eq("id", p.id);
  } catch {}

  return j({
    ok: true,
    slug,
    provider_id: p.id,
    action: expire ? "expired" : "purchased",
    boost_until_ts: until,
  });
}
