// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const IST_OFFSET_MIN = 330;
const now = () => new Date();

function toISTMidnightUTC(d: Date) {
  const ms = d.getTime() + IST_OFFSET_MIN * 60_000;
  const x = new Date(ms);
  x.setUTCHours(0, 0, 0, 0);
  return new Date(x.getTime() - IST_OFFSET_MIN * 60_000);
}
function startOfTodayIST() { return toISTMidnightUTC(now()); }
function startOfMonthIST() { const d = toISTMidnightUTC(now()); d.setUTCDate(1); return d; }
function startOfPrevMonthIST() { const d = toISTMidnightUTC(now()); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d; }

async function safeSum(supabase, startISO: string, endISO?: string) {
  try {
    let q = supabase.from("Payments").select("amount,created_at");
    q = q.gte("created_at", startISO);
    if (endISO) q = q.lt("created_at", endISO);
    const { data, error } = await q;
    if (error) return 0;
    return (data || []).reduce((acc, r) => {
      const v = Number(r?.amount);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

    const todayStart = startOfTodayIST();
    const monthStart = startOfMonthIST();
    const prevMonthStart = startOfPrevMonthIST();
    const last7Start = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Start = new Date(now().getTime() - 30 * 24 * 60 * 60 * 1000);

    const [today, last7, last30, mtd, lmtd] = await Promise.all([
      safeSum(supabase, todayStart.toISOString()),
      safeSum(supabase, last7Start.toISOString()),
      safeSum(supabase, last30Start.toISOString()),
      safeSum(supabase, monthStart.toISOString()),
      safeSum(supabase, prevMonthStart.toISOString(), todayStart.toISOString()),
    ]);

    const deltaPct = lmtd > 0 ? Math.round(((mtd - lmtd) / lmtd) * 100) : null;

    return NextResponse.json({
      ok: true,
      today, last7, last30, mtd, lmtd, deltaPct
    });
  } catch {
    return NextResponse.json({ ok: true, today: 0, last7: 0, last30: 0, mtd: 0, lmtd: 0, deltaPct: null });
  }
}
