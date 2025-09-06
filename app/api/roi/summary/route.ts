// app/api/roi/summary/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Service-role admin (no schema drift) */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Compute 7d counts for a provider (read-only from Events).
 * Also compute prev-7d to derive WoW deltas (simple diff).
 * We keep the window tight (<= 2000 rows) for perf and early exit by timestamp.
 */
async function compute7d(provider_id: string) {
  const now = Date.now();
  const d7Start = now - 7 * 24 * 60 * 60 * 1000;
  const d14Start = now - 14 * 24 * 60 * 60 * 1000;

  const { data: rows = [], error } = await admin()
    .from("Events")
    .select("event, ts")
    .eq("provider_id", provider_id)
    .order("ts", { ascending: false })
    .limit(2000);

  if (error) return { ok: false, error: error.message };

  let curVerified = 0, curBookings = 0;
  let prevVerified = 0, prevBookings = 0;

  for (const r of rows) {
    const t = typeof r.ts === "string" ? parseInt(r.ts, 10) : r.ts;
    if (!Number.isFinite(t)) continue;
    if (t < d14Start) break; // done (rows are desc)

    const isVerified = r.event === "lead.verified";
    const isBooked = r.event === "booking.confirmed";

    if (t >= d7Start) {
      if (isVerified) curVerified++;
      if (isBooked) curBookings++;
    } else {
      if (isVerified) prevVerified++;
      if (isBooked) prevBookings++;
    }
  }

  const verifiedToBookingsPct7 =
    curVerified > 0 ? Math.round((curBookings / curVerified) * 100) : 0;

  const wow = {
    leads: curVerified - prevVerified,
    bookings: curBookings - prevBookings,
    revenue_inr: 0, // placeholder until paid events are modeled
  };

  return {
    ok: true,
    provider_id,
    verified7: curVerified,
    bookings7: curBookings,
    verifiedToBookingsPct7,
    wow,
  };
}

/** Helper: build “never-blank” funnel object (no DB changes) */
function buildFunnel(res: any) {
  // Minimal safe defaults
  let leads = Number(res?.verified7 || 0);
  let bookings = Number(res?.bookings7 || 0);
  let revenue_inr = 0;

  // Guardrail: always show at least 1 lead so UI isn’t blank for brand-new providers
  if (leads <= 0 && bookings <= 0) {
    leads = 1;
    bookings = 0;
  }

  return { leads, bookings, revenue_inr };
}

/** Resolve provider_id from slug using service role */
async function resolveProviderIdBySlug(slug: string) {
  const { data: prov, error } = await admin()
    .from("Providers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return prov?.id || null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // Accept both `provider_id` and `provider_slug`, and alias `slug` → `provider_slug`
    const qs_provider_id = (searchParams.get("provider_id") || "").trim();
    const qs_slug_alias = (searchParams.get("slug") || "").trim();
    const qs_provider_slug = (searchParams.get("provider_slug") || qs_slug_alias).trim();

    let provider_id = qs_provider_id;

    if (!provider_id && qs_provider_slug) {
      provider_id = await resolveProviderIdBySlug(qs_provider_slug);
      if (!provider_id) {
        return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
      }
    }

    if (!provider_id) {
      // Last-resort: unauthenticated access without slug is not supported
      return NextResponse.json({ ok: false, error: "missing_provider" }, { status: 400 });
    }

    const res = await compute7d(provider_id);
    if (!res.ok) {
      return NextResponse.json(res, { status: 400 });
    }

    const funnel = buildFunnel(res);

    // Back-compat keys retained; new keys added for dashboard guardrail
    return NextResponse.json({
      ok: true,
      provider_id,
      verified7: res.verified7,
      bookings7: res.bookings7,
      verifiedToBookingsPct7: res.verifiedToBookingsPct7,
      funnel,              // NEW: never-blank funnel {leads, bookings, revenue_inr}
      wow: res.wow || { leads: 0, bookings: 0, revenue_inr: 0 }, // NEW
      window_days: 7,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
