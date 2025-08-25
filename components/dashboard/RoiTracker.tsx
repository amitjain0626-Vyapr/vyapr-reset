// @ts-nocheck
// Server component: computes INR revenue across time windows for the signed-in owner.
import { createSupabaseServerClient } from "@/lib/supabase/server";

// --- Time helpers (IST-accurate boundaries) ---
const IST_OFFSET_MIN = 330; // +05:30

function toISTMidnightUTC(dateUtc: Date) {
  const ms = dateUtc.getTime() + IST_OFFSET_MIN * 60_000;
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_OFFSET_MIN * 60_000); // IST midnight expressed in UTC
}

function startOfTodayIST() {
  return toISTMidnightUTC(new Date());
}
function startOfMonthIST() {
  const now = new Date();
  const istMid = toISTMidnightUTC(now);
  // Jump to day 1 in IST
  const d = new Date(istMid);
  d.setUTCDate(1);
  return d;
}
function startOfPrevMonthIST() {
  const now = new Date();
  const istMid = toISTMidnightUTC(now);
  const d = new Date(istMid);
  d.setUTCMonth(d.getUTCMonth() - 1, 1);
  return d;
}

const STATUSES_OK = ["success", "paid", "captured"]; // tolerate common gateways

async function sumForRange(supabase, ownerId: string, startUtcISO: string, endUtcISO?: string) {
  let q = supabase
    .from("Payments")
    .select("amount", { head: false })
    .eq("owner_id", ownerId)
    .in("status", STATUSES_OK)
    .gte("created_at", startUtcISO);

  if (endUtcISO) q = q.lt("created_at", endUtcISO);

  const { data, error } = await q;
  if (error) throw error;

  // Sum numbers; ignore null/NaN defensively
  return (data || []).reduce((acc, row) => {
    const v = Number(row.amount);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(n)));
  } catch {
    return `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;
  }
}

export default async function RoiTracker() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Boundaries (all in UTC, aligned to IST where relevant)
  const now = new Date();
  const todayStart = startOfTodayIST();
  const monthStart = startOfMonthIST();
  const prevMonthStart = startOfPrevMonthIST();

  const last7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Compute sums
  const [today, last7, last30, mtd, lmtd] = await Promise.all([
    sumForRange(supabase, user.id, todayStart.toISOString()),                 // Today → now
    sumForRange(supabase, user.id, last7Start.toISOString()),                 // Rolling 7D
    sumForRange(supabase, user.id, last30Start.toISOString()),                // Rolling 30D
    sumForRange(supabase, user.id, monthStart.toISOString()),                 // MTD (from 1st IST)
    sumForRange(supabase, user.id, prevMonthStart.toISOString(), todayStart.toISOString()), // LMTD
  ]);

  const deltaPct = lmtd > 0 ? Math.round(((mtd - lmtd) / lmtd) * 100) : null;

  const stats = [
    { label: "Today", value: fmtINR(today), sub: "Since midnight IST" },
    { label: "7D", value: fmtINR(last7), sub: "Last 7 days (rolling)" },
    { label: "30D", value: fmtINR(last30), sub: "Last 30 days (rolling)" },
    { label: "MTD", value: fmtINR(mtd), sub: "Month-to-date (IST)" },
    {
      label: "LMTD",
      value: fmtINR(lmtd),
      sub: "Last month to date",
    },
  ];

  return (
    <div className="mb-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-white"
          >
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
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct}%{/* growth */}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
