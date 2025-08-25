// @ts-nocheck
// Server component: robust to missing columns/schemas in prod
import { createSupabaseServerClient } from "../../lib/supabase/server";

const IST_OFFSET_MIN = 330;

function toISTMidnightUTC(dateUtc: Date) {
  const ms = dateUtc.getTime() + IST_OFFSET_MIN * 60_000;
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_OFFSET_MIN * 60_000);
}
function startOfTodayIST() { return toISTMidnightUTC(new Date()); }
function startOfMonthIST() { const d = toISTMidnightUTC(new Date()); d.setUTCDate(1); return d; }
function startOfPrevMonthIST() { const d = toISTMidnightUTC(new Date()); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d; }

function fmtINR(n: number) {
  try { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.max(0, Math.round(n))); }
  catch { return `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`; }
}

async function safeSumForRange(supabase, startISO: string, endISO?: string) {
  // ❗ Don’t filter on columns that may not exist (owner_id/provider_id). Let RLS scope rows.
  // Select minimal fields and sum in JS; tolerate tables missing entirely.
  try {
    let q = supabase.from("Payments").select("amount,created_at", { head: false }).gte("created_at", startISO);
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

export default async function RoiTracker() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date();
    const todayStart = startOfTodayIST();
    const monthStart = startOfMonthIST();
    const prevMonthStart = startOfPrevMonthIST();
    const last7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [today, last7, last30, mtd, lmtd] = await Promise.all([
      safeSumForRange(supabase, todayStart.toISOString()),
      safeSumForRange(supabase, last7Start.toISOString()),
      safeSumForRange(supabase, last30Start.toISOString()),
      safeSumForRange(supabase, monthStart.toISOString()),
      safeSumForRange(supabase, prevMonthStart.toISOString(), todayStart.toISOString()),
    ]);

    const deltaPct = lmtd > 0 ? Math.round(((mtd - lmtd) / lmtd) * 100) : null;

    const stats = [
      { label: "Today", value: fmtINR(today), sub: "Since midnight IST" },
      { label: "7D", value: fmtINR(last7), sub: "Last 7 days (rolling)" },
      { label: "30D", value: fmtINR(last30), sub: "Last 30 days (rolling)" },
      { label: "MTD", value: fmtINR(mtd), sub: "Month-to-date (IST)" },
      { label: "LMTD", value: fmtINR(lmtd), sub: "Last month to date" },
    ];

    return (
      <div className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-white">
              <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold">{s.value}</div>
              <div className="text-[11px] text-gray-500 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {deltaPct === null ? (
            <span className="italic">MTD vs LMTD: not enough data last month.</span>
          ) : (
            <span>
              MTD vs LMTD:{" "}
              <span className={deltaPct >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                {deltaPct >= 0 ? "+" : ""}{deltaPct}%
              </span>
            </span>
          )}
        </div>
      </div>
    );
  } catch {
    // If anything goes wrong (missing table, etc.), render nothing instead of crashing prod.
    return null;
  }
}
