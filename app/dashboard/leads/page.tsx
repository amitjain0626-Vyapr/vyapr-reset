// app/dashboard/leads/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import LeadsClientTable from "@/components/leads/LeadsClientTable";
import QuickAddLead from "@/components/leads/QuickAddLead";
import TopCampaigns from "@/components/roi/TopCampaigns";
import KpiCard from "@/components/ui/KpiCard";
import VeliPanel from "@/components/copilot/VeliPanel";
import ReferralCard from "@/components/referral/ReferralCard";
import { createClient } from "@supabase/supabase-js";
import LeadsTable from "@/components/leads/LeadsTable";
import CalendarConnectHint from "@/components/calendar/CalendarConnectHint";
import CalendarStatusPill from "@/components/calendar/CalendarStatusPill";
/* INSERT: client widget for quick verification */
import UnverifiedImports from "@/components/leads/UnverifiedImports";

/* ---------- Supabase admin (server) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- Types ---------- */
type Provider =
  | { id: string; slug: string; display_name?: string | null }
  | null;
type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/* ---------- Safe helpers (never throw) ---------- */
async function getProviderBySlugSafe(slug: string): Promise<Provider> {
  try {
    if (!slug) return null;
    const { data, error } = await admin()
      .from("Providers")
      .select("id, slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data?.id) return null;
    return { id: data.id, slug: data.slug, display_name: data.display_name };
  } catch {
    return null;
  }
}

async function fetchLeadsSafe(providerId: string | null): Promise<Lead[]> {
  try {
    if (!providerId) return [];
    const { data = [] } = await admin()
      .from("Leads")
      .select("id, patient_name, phone, status, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(500);
    return data || [];
  } catch {
    return [];
  }
}
async function updateStatus(id: string, status: string) {
  await fetch("/api/leads/update-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, provider_slug: "amitjain0626" }),
  });
  fetchLeads();
}

/* ---------- ROI + WoW deltas (+ verified funnel) ---------- */
async function fetchRoiSafe(providerId: string | null) {
  if (!providerId)
    return {
      d7: 0,
      prev7: 0,
      delta7Text: "—",
      mtd: 0,
      lmtd: 0,
      deltaMText: "—",
      bookings: 0,
      payments: 0,
      bookings7: 0,
      prevBookings7: 0,
      payments7: 0,
      prevPayments7: 0,
      paidLeads7: 0,
      pending7: 0,
      deltaBookings7Text: "—",
      deltaPayments7Text: "—",
      verified7: 0,
      prevVerified7: 0,
      verifiedToBookingsPct7: 0,
      pendingAmount7: 0,
      leadToPaidPct7: 0,
      bookingToPaidPct7: 0,
    };
  try {
    const sb = admin();
    const now = Date.now(),
      d7Cut = now - 7 * 24 * 60 * 60 * 1000,
      d14Cut = now - 14 * 24 * 60 * 60 * 1000;
    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);
    const lmStart = new Date();
    lmStart.setMonth(lmStart.getMonth() - 1);
    lmStart.setDate(1);
    lmStart.setHours(0, 0, 0, 0);
    const lmEnd = new Date(mtdStart.getTime() - 1);

    const { data: rows = [] } = await sb
      .from("Events")
      .select("event, ts, source, lead_id")
      .eq("provider_id", providerId)
      .gte("ts", lmStart.getTime());

    let d7 = 0,
      prev7 = 0,
      mtd = 0,
      lmtd = 0,
      bookings = 0,
      payments = 0,
      bookings7 = 0,
      prevBookings7 = 0,
      payments7 = 0,
      prevPayments7 = 0,
      verified7 = 0,
      prevVerified7 = 0;

    const paid7 = new Set<string>();
    // Track booking rows inside last 7d with optional expected amount
    const bookings7Rows: Array<{ lead_id?: string | null; amount: number }> = [];

    for (const r of rows) {
      const amt = typeof r?.source?.amount === "number" ? r.source.amount : 0;

      if (r.event === "payment.success") {
        payments++;
        if (r.ts >= d7Cut) {
          d7 += amt;
          payments7++;
          if (r.lead_id) paid7.add(r.lead_id);
        }
        if (r.ts >= d14Cut && r.ts < d7Cut) {
          prev7 += amt;
          prevPayments7++;
        }
        if (r.ts >= mtdStart.getTime()) mtd += amt;
        if (r.ts >= lmStart.getTime() && r.ts <= lmEnd.getTime()) lmtd += amt;
      }

      if (r.event === "booking.confirmed") {
        const bAmt =
          typeof r?.source?.amount === "number" ? r.source.amount : 0;
        bookings++;
        if (r.ts >= d7Cut) bookings7++;
        if (r.ts >= d7Cut) {
          bookings7Rows.push({ lead_id: r.lead_id, amount: bAmt });
        }
        if (r.ts >= d14Cut && r.ts < d7Cut) prevBookings7++;
      }

      if (r.event === "lead.verified") {
        if (r.ts >= d7Cut) verified7++;
        if (r.ts >= d14Cut && r.ts < d7Cut) prevVerified7++;
      }
    }

    const mkDelta = (c: number, p: number) =>
      p === 0 && c === 0
        ? "—"
        : p === 0
        ? "↑ new"
        : c === 0
        ? "↓ 100%"
        : `${c - p > 0 ? "↑" : "↓"} ${Math.round(
            Math.abs(((c - p) / p) * 100)
          )}%`;

    // Compute pending amount (booked but not yet paid) in last 7d
    let pendingAmount7 = 0;
    for (const b of bookings7Rows) {
      const lead = b.lead_id || "";
      if (!paid7.has(lead)) pendingAmount7 += b.amount || 0;
    }

    // Conversion % helpers (7d)
    const verifiedToBookingsPct7 =
      verified7 > 0 ? Math.round((bookings7 / verified7) * 100) : 0;
    const leadToPaidPct7 =
      verified7 > 0 ? Math.round((paidLeads7 / verified7) * 100) : 0;
    const bookingToPaidPct7 =
      bookings7 > 0 ? Math.round((paidLeads7 / bookings7) * 100) : 0;

    return {
      d7,
      prev7,
      delta7Text: mkDelta(d7, prev7),
      mtd,
      lmtd,
      deltaMText: mkDelta(mtd, lmtd),
      bookings,
      payments,
      bookings7,
      prevBookings7,
      payments7,
      prevPayments7,
      deltaBookings7Text: mkDelta(bookings7, prevBookings7),
      deltaPayments7Text: mkDelta(payments7, prevPayments7),
      paidLeads7: paid7.size,
      pending7: Math.max(bookings7 - paidLeads7, 0),
      verified7,
      prevVerified7,
      verifiedToBookingsPct7,
      pendingAmount7,
      leadToPaidPct7,
      bookingToPaidPct7,
    };
  } catch {
    return {
      d7: 0,
      prev7: 0,
      delta7Text: "—",
      mtd: 0,
      lmtd: 0,
      deltaMText: "—",
      bookings: 0,
      payments: 0,
      bookings7: 0,
      prevBookings7: 0,
      payments7: 0,
      prevPayments7: 0,
      paidLeads7: 0,
      pending7: 0,
      deltaBookings7Text: "—",
      deltaPayments7Text: "—",
      verified7: 0,
      prevVerified7: 0,
      verifiedToBookingsPct7: 0,
      pendingAmount7: 0,
      leadToPaidPct7: 0,
      bookingToPaidPct7: 0,
    };
  }
}

/* ---------- Empty-slot signals ---------- */
async function fetchIdleSignalsSafe(providerId: string | null) {
  try {
    if (!providerId)
      return {
        hasActivity24h: false,
        hoursSinceAny: null,
        lastAnyTs: null,
        reason: "no-provider",
      };
    const sb = admin();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const lookback = now - 14 * dayMs;
    const { data: rows = [] } = await sb
      .from("Events")
      .select("event, ts")
      .eq("provider_id", providerId)
      .gte("ts", lookback);

    let lastAnyTs: number | null = null;
    for (const r of rows) {
      if (typeof r?.ts === "number") {
        if (lastAnyTs === null || r.ts > lastAnyTs) lastAnyTs = r.ts;
      }
    }
    const hasActivity24h = !!(lastAnyTs && now - lastAnyTs < dayMs);
    const hoursSinceAny = lastAnyTs
      ? Math.floor((now - lastAnyTs) / (60 * 60 * 1000))
      : null;

    return { hasActivity24h, hoursSinceAny, lastAnyTs, reason: "ok" };
  } catch {
    return {
      hasActivity24h: false,
      hoursSinceAny: null,
      lastAnyTs: null,
      reason: "error",
    };
  }
}

/* ---------- Weekly series ---------- */
async function fetchWeeklySeriesSafe(providerId: string | null) {
  if (!providerId)
    return Array.from({ length: 8 }).map((_, i) => ({
      label: `W${String(i + 1).padStart(2, "0")}`,
      amount: 0,
    }));
  try {
    const sb = admin();
    const start = Date.now() - 56 * 24 * 60 * 60 * 1000;
    const { data: rows = [] } = await sb
      .from("Events")
      .select("event, ts, source")
      .eq("provider_id", providerId)
      .gte("ts", start)
      .eq("event", "payment.success");
    const byWeek = new Map<string, number>();
    for (const r of rows) {
      const amt = typeof r?.source?.amount === "number" ? r.source.amount : 0;
      const d = new Date(r.ts),
        oneJan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(
        ((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) /
          7
      );
      const label = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
      byWeek.set(label, (byWeek.get(label) || 0) + amt);
    }
    const res: any[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const ref = new Date(now);
      ref.setDate(ref.getDate() - i * 7);
      const oneJan = new Date(ref.getFullYear(), 0, 1);
      const week = Math.ceil(
        ((ref.getTime() - oneJan.getTime()) / 86400000 +
          oneJan.getDay() +
          1) /
          7
      );
      const label = `${ref.getFullYear()}-W${String(week).padStart(2, "0")}`;
      res.push({ label, amount: byWeek.get(label) || 0 });
    }
    return res;
  } catch {
    return Array.from({ length: 8 }).map((_, i) => ({
      label: `W${String(i + 1).padStart(2, "0")}`,
      amount: 0,
    }));
  }
}

/* ---------- Page ---------- */
export default async function LeadsPage(props: any) {
  const spRaw = props?.searchParams;
  const searchParams =
    spRaw && typeof spRaw.then === "function" ? await spRaw : spRaw || {};
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";
  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
const status = typeof searchParams?.status === "string" ? searchParams.status.trim().toLowerCase() : "";
const validStatuses = new Set(["", "new", "verified", "booked", "paid"]);
const statusSafe = validStatuses.has(status) ? status : "";
  const provider = await getProviderBySlugSafe(slug);
  const providerId = provider?.id || null;

  const [leads, roi, weekly, idle] = await Promise.all([
    fetchLeadsSafe(providerId),
    fetchRoiSafe(providerId),
    fetchWeeklySeriesSafe(providerId),
    fetchIdleSignalsSafe(providerId),
  ]);
  // Basic, safe filtering (no schema drift)
const leadsAll = Array.isArray(leads) ? leads : [];
const leadsFiltered = leadsAll.filter((r) => {
  const s = (r?.status || "").toLowerCase();
  const name = (r?.patient_name || "").toLowerCase();
  const phone = (r?.phone || "").toLowerCase();
  const qOk = q ? name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase()) : true;
  const stOk = statusSafe ? s === statusSafe : true;
  return qOk && stOk;
});

// Status counts for chips
const counts = leadsAll.reduce(
  (acc: any, r: any) => {
    const s = (r?.status || "").toLowerCase();
    if (s === "new") acc.new++;
    else if (s === "verified") acc.verified++;
    else if (s === "booked") acc.booked++;
    else if (s === "paid") acc.paid++;
    else acc.other++;
    acc.all++;
    return acc;
  },
  { all: 0, new: 0, verified: 0, booked: 0, paid: 0, other: 0 }
);

  const nudgesHref = slug
    ? `/dashboard/nudges?slug=${encodeURIComponent(slug)}`
    : "/dashboard/nudges";
  const upsellHref = slug
    ? `/upsell?slug=${encodeURIComponent(slug)}`
    : "/upsell";
  const templatesHref = slug
    ? `/templates?slug=${encodeURIComponent(slug)}`
    : "/templates";

    function withParams(next: { q?: string; status?: string }) {
  const u = new URLSearchParams();
  if (slug) u.set("slug", slug);
  const qVal = typeof next.q === "string" ? next.q : q;
  const sVal = typeof next.status === "string" ? next.status : statusSafe;
  if (qVal) u.set("q", qVal);
  if (sVal) u.set("status", sVal);
  return `/dashboard/leads?${u.toString()}`;
}
  const showEmptySlots =
    !idle.hasActivity24h ||
    ((roi.bookings7 || 0) < 2 && (roi.payments7 || 0) < 2);

  // 🔒 MVP: always show upsell bar (we can add smart gating later)
  const showUpsellNudge = true;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>

        <div className="flex items-center gap-2">
          <CalendarStatusPill />
          <VeliPanel
            slug={slug}
            provider={provider?.display_name || slug || "your service provider"}
          />
          <QuickAddLead slug={slug} />
        </div>
      </div>

{/* Search + Filters */}
<div className="rounded-2xl border p-3 bg-white">
  <form method="GET" action="/dashboard/leads" className="flex flex-col md:flex-row md:items-center gap-2">
    {/* keep slug on submit */}
    {slug ? <input type="hidden" name="slug" value={slug} /> : null}
    <input
      type="text"
      name="q"
      defaultValue={q}
      placeholder="Search name or phone (all TGs)"
      className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm"
    />
    <div className="flex items-center gap-1 text-xs">
      <a href={withParams({ status: "" })} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 border ${statusSafe==="" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800"}`}>
        All <span className="opacity-70">({counts.all})</span>
      </a>
      <a href={withParams({ status: "new" })} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 border ${statusSafe==="new" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800"}`}>
        New <span className="opacity-70">({counts.new})</span>
      </a>
      <a href={withParams({ status: "verified" })} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 border ${statusSafe==="verified" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800"}`}>
        Verified <span className="opacity-70">({counts.verified})</span>
      </a>
      <a href={withParams({ status: "booked" })} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 border ${statusSafe==="booked" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800"}`}>
        Booked <span className="opacity-70">({counts.booked})</span>
      </a>
      <a href={withParams({ status: "paid" })} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 border ${statusSafe==="paid" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800"}`}>
        Paid <span className="opacity-70">({counts.paid})</span>
      </a>
    </div>
    <button type="submit" className="rounded-xl bg-gray-900 text-white px-3 py-2 text-sm">
      Search
    </button>
  </form>
  <div className="mt-2 text-[11px] text-gray-500">
    Works for all categories: dentists, astrologers, fitness, beauty — this inbox is generic by design.
  </div>
</div>

{/* Calendar connect hint (only shows when token missing) */}
      <CalendarConnectHint />

      {/* Quick verify widget for imported contacts */}
      <UnverifiedImports providerId={providerId} slug={slug} />

      {/* Referral card */}
      <ReferralCard
        slug={slug}
        providerName={provider?.display_name || slug || "your service provider"}
      />

      {/* Upsell nudge bar */}
      {showUpsellNudge && (
        <div className="rounded-2xl border p-4 bg-indigo-50 text-indigo-900">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                ⚡ Grow faster with Vyapr Growth
              </div>
              <div className="text-xs">
                More bookings and fewer no-shows — unlock paid discovery,
                auto-reminders, and review helpers.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={upsellHref}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-white shadow hover:bg-indigo-700 transition text-sm"
              >
                🚀 Boost visibility
              </a>
              <a
                href={templatesHref}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-600 px-3 py-1.5 text-indigo-700 bg-white hover:bg-indigo-50 transition text-sm"
              >
                🧰 Template packs
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Empty slot alert banner */}
      {showEmptySlots && (
        <div className="rounded-2xl border p-4 bg-amber-50 text-amber-900">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Empty slot alert</div>
              <div className="text-xs">
                {idle.hasActivity24h
                  ? "Light week detected — few bookings/payments in the last 7 days."
                  : idle.hoursSinceAny == null
                  ? "No recent booking or payment activity. Add your first service to get started."
                  : `No booking/payment activity in the last ${idle.hoursSinceAny} hours.`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={nudgesHref}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-white shadow hover:bg-emerald-700 transition text-sm"
              >
                💬 Send reactivation nudges
              </a>
              <a
                href={upsellHref}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-600 px-3 py-1.5 text-indigo-700 bg-white hover:bg-indigo-50 transition text-sm"
              >
                🚀 Boost visibility
              </a>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards with WoW deltas + verified→bookings funnel */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard
          label="₹ in last 7 days"
          value={roi.d7 > 0 ? `₹${Math.round(roi.d7)}` : "₹0 (start by adding leads)"}
          deltaText={roi.delta7Text}
          help="Sum of payment.success in the last 7 days. Delta vs the 7 days before that."
          tone={
            roi.d7 > (roi.prev7 || 0)
              ? "success"
              : roi.d7 < (roi.prev7 || 0)
              ? "warn"
              : "neutral"
          }
        />
        <KpiCard
          label="MTD revenue"
          value={roi.mtd > 0 ? `₹${Math.round(roi.mtd)}` : "₹0 (no payments yet)"}
          deltaText={roi.deltaMText}
          help="Month-to-date vs last month-to-date. Based on payment.success amounts."
          tone={
            roi.mtd > (roi.lmtd || 0)
              ? "success"
              : roi.mtd < (roi.lmtd || 0)
              ? "warn"
              : "neutral"
          }
        />
        <KpiCard
          label="Bookings (7d)"
          value={roi.bookings7 > 0 ? roi.bookings7 : "0 (none yet)"}
          deltaText={roi.deltaBookings7Text}
          help="booking.confirmed in last 7 days vs previous 7 days."
          tone={
            roi.bookings7 > (roi.prevBookings7 || 0)
              ? "success"
              : roi.bookings7 < (roi.prevBookings7 || 0)
              ? "warn"
              : "neutral"
          }
        />
        <KpiCard
          label="Payments (7d)"
          value={roi.payments7 > 0 ? roi.payments7 : "0 (none yet)"}
          deltaText={roi.deltaPayments7Text}
          help="payment.success in last 7 days vs previous 7 days."
          tone={
            roi.payments7 > (roi.prevPayments7 || 0)
              ? "success"
              : roi.payments7 < (roi.prevPayments7 || 0)
              ? "warn"
              : "neutral"
          }
        />
        {/* NEW: Pending ₹ (7d) — unpaid booked amount */}
        <KpiCard
          label="Pending ₹ (7d)"
          value={
            roi.pendingAmount7 > 0
              ? `₹${Math.round(roi.pendingAmount7)}`
              : "₹0 (all clear)"
          }
          deltaText=""
          help="Sum of expected booking amounts in the last 7 days where payment.success not seen yet."
          tone={roi.pendingAmount7 > 0 ? "warn" : "success"}
        />
        {/* NEW: Leads→Paid % (7d) */}
        <KpiCard
          label="Leads→Paid % (7d)"
          value={`${roi.leadToPaidPct7 || 0}%`}
          deltaText=""
          help="Paid leads in last 7 days divided by verified leads."
          tone="neutral"
        />
        <KpiCard
          label="Verified→Bookings % (7d)"
          value={`${roi.verifiedToBookingsPct7 || 0}%`}
          deltaText=""
          help="bookings.confirmed divided by lead.verified in last 7 days."
          tone="neutral"
        />
      </div>

      {/* Weekly trend line */}
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">Weekly growth (last 8 weeks)</h2>
          <div className="text-xs text-gray-500">
            Source: Events.payment.success
          </div>
        </div>
        <LineChart series={weekly} />
      </div>

      <TopCampaigns slug={slug} />

      {provider ? (
  leadsFiltered.length > 0 ? (
    <LeadsClientTable rows={leadsFiltered} provider={provider} />
        ) : (
          <div className="rounded-xl border p-4 bg-gray-50 text-gray-600 text-sm">
  {q || statusSafe
    ? "No matching leads — clear filters to see all."
    : "No leads yet — add your first lead using the “Quick Add” button above."}
</div>
)
) : (
  <div className="rounded-xl border p-4 bg-amber-50 text-amber-900 text-sm">
    Provider not found for slug <code>{slug || "(empty)"}</code>.
  </div>
)}
</main>
  );
}

/* ---------- LineChart (unchanged) ---------- */
function LineChart({
  series,
}: {
  series: Array<{ label: string; amount: number }>;
}) {
  const w = 560,
    h = 160,
    pad = 24,
    xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
  const max = Math.max(1, ...series.map((s) => s.amount)),
    ys = (v: number) => h - pad - (v * (h - pad * 2)) / max;
  const path = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(s.amount)}`)
    .join(" ");
  const labels = series.map((s) =>
    s.label.includes("-W") ? s.label.split("-W")[1] : s.label
  );
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="currentColor"
        opacity="0.2"
      />
      <line
        x1={pad}
        y1={pad}
        x2={pad}
        y2={h - pad}
        stroke="currentColor"
        opacity="0.2"
      />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      {series.map((s, i) => (
        <circle key={i} cx={xs(i)} cy={ys(s.amount)} r="2.5" fill="currentColor" />
      ))}
      {series.map((s, i) => (
        <text
          key={i}
          x={xs(i)}
          y={h - 6}
          fontSize="10"
          textAnchor="middle"
          opacity="0.6"
        >
          {labels[i]}
        </text>
      ))}
      <text
        x={w - pad}
        y={pad + 10}
        fontSize="10"
        textAnchor="end"
        opacity="0.6"
      >
        ₹{Math.round(max)}
      </text>
    </svg>
  );
}
