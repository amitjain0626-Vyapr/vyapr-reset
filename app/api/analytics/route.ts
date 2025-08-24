// app/api/analytics/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Normalize YYYY-MM-DD -> full-day ISO window */
function normalizeWindow(fromStr?: string, toStr?: string) {
  const now = new Date();
  const to = toStr ? new Date(toStr + "T23:59:59.999") : now;
  const from = fromStr ? new Date(fromStr + "T00:00:00.000") : new Date(to.getTime() - 13 * 24 * 3600 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, expires: new Date(0) });
        },
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabase();

  // must be signed in (RLS will scope to provider)
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from") || "";
  const toParam = url.searchParams.get("to") || "";
  const { fromIso, toIso } = normalizeWindow(fromParam, toParam);

  // Pull last ~60 days to compute 7d/14d easily (cheap)
  const since = new Date(new Date(toIso).getTime() - 60 * 24 * 3600 * 1000).toISOString();

  // Fetch records visible to this user (RLS)
  // Expect Leads table to have: id, created_at, phone, source (jsonb, optional)
  const { data: leads, error } = await supabase
    .from("Leads")
    .select("id, created_at, phone, source")
    .gte("created_at", since)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Filter to requested window for the main stats
  const inWindow = (leads || []).filter(
    (r) => r.created_at >= fromIso && r.created_at <= toIso
  );

  // KPIs
  const totalLeads = inWindow.length;
  const uniquePhones = new Set(
    inWindow.map((r) => (r.phone || "").replace(/[^\d+]/g, ""))
  );
  const last7Start = new Date(new Date(toIso).getTime() - 6 * 24 * 3600 * 1000).toISOString();
  const last7Count = (leads || []).filter(
    (r) => r.created_at >= last7Start && r.created_at <= toIso
  ).length;

  // Daily counts for sparkline (14-day window ending at `toIso`)
  const dayBuckets: Record<string, number> = {};
  const days: string[] = [];
  const toDate = new Date(toIso);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(toDate.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    days.push(key);
    dayBuckets[key] = 0;
  }
  for (const r of leads || []) {
    const key = r.created_at.slice(0, 10);
    if (key in dayBuckets) dayBuckets[key] += 1;
  }
  const daily = days.map((d) => ({ day: d, count: dayBuckets[d] || 0 }));

  // Source breakdown (within requested window)
  const sourceMap: Record<string, number> = {};
  for (const r of inWindow) {
    const src =
      (r?.source?.utm?.source as string) ||
      (r?.source?.source as string) ||
      "unknown";
    const key = (src || "unknown").toLowerCase();
    sourceMap[key] = (sourceMap[key] || 0) + 1;
  }
  const bySource = Object.entries(sourceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  return NextResponse.json({
    ok: true,
    data: {
      window: { fromIso, toIso },
      kpis: {
        totalLeads,
        uniquePhones: uniquePhones.size,
        last7Days: last7Count,
      },
      daily,     // [{day:'YYYY-MM-DD', count:n}, ... 14 pts]
      bySource,  // [{source, count}]
    },
  });
}
