// app/dashboard/page.tsx
// Next.js 15 (App Router) — Server Component
// UI-only dashboard with safe Supabase fetch + mock fallback.
// @ts-nocheck
import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";

// If you already have this helper, keep your version.
// This local import is included below.
import { getSupabaseServer } from "@/lib/supabase/server";

import KPICard from "@/components/dashboard/KPICard";
import TrendChart from "@/components/dashboard/TrendChart";
import LeadTable from "@/components/dashboard/LeadTable";

export const dynamic = "force-dynamic";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

type Lead = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  source: "WhatsApp" | "Instagram" | "Microsite" | "Referral";
  status: "New" | "In Progress" | "Won" | "Lost";
  unread?: boolean;
  note?: string;
  value?: number; // INR amount for projected/actual revenue
};

type DashboardData = {
  slug: string;
  revenueThisMonth: number;
  leadsThisMonth: number;
  bookingsThisMonth: number;
  roiPct: number;
  roiSeries: { date: string; value: number }[];
  leads: Lead[];
};

async function fetchDashboardData(slug: string): Promise<DashboardData> {
  // Try Supabase first; on any error or missing env, return mock data.
  try {
    const supabase = await getSupabaseServer();
    if (!supabase) throw new Error("Supabase unavailable");

    // --- Example queries (adjust to your schema) ---
    // 1) Resolve provider by slug
    const { data: provider, error: providerErr } = await supabase
      .from("Providers")
      .select("id")
      .eq("slug", slug)
      .single();

    if (providerErr || !provider?.id) throw new Error("Provider not found");

    const providerId = provider.id;

    // 2) Aggregate revenue/bookings/leads for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Example payments/query (adjust table/columns as per schema)
    const { data: payments, error: payErr } = await supabase
      .from("Payments")
      .select("amount, created_at")
      .eq("provider_id", providerId)
      .gte("created_at", startOfMonth.toISOString());

    if (payErr) throw payErr;

    const revenueThisMonth =
      payments?.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0) ?? 0;

    // Example bookings
    const { data: bookings, error: bookingsErr } = await supabase
      .from("Bookings")
      .select("id, created_at")
      .eq("provider_id", providerId)
      .gte("created_at", startOfMonth.toISOString());

    if (bookingsErr) throw bookingsErr;
    const bookingsThisMonth = bookings?.length ?? 0;

    // Example leads
    const { data: leadsData, error: leadsErr } = await supabase
      .from("Leads")
      .select(
        "id, created_at, name, phone, source, status, unread, note, value"
      )
      .eq("provider_id", providerId)
      .gte("created_at", startOfMonth.toISOString())
      .order("created_at", { ascending: false });

    if (leadsErr) throw leadsErr;
    const leadsThisMonth = leadsData?.length ?? 0;

    // Example ROI series (use payments per day)
    const byDay: Record<string, number> = {};
    (payments ?? []).forEach((p: any) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      byDay[key] = (byDay[key] ?? 0) + (p.amount ?? 0);
    });

    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(startOfMonth);
      d.setDate(d.getDate() + i);
      return d;
    });
    const roiSeries = days.map((d) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      return { date: key, value: byDay[key] ?? 0 };
    });

    // ROI% placeholder formula (replace with real baseline later)
    const baseline = Math.max(1, revenueThisMonth * 0.6);
    const roiPct = Math.round(((revenueThisMonth - baseline) / baseline) * 100);

    return {
      slug,
      revenueThisMonth,
      leadsThisMonth,
      bookingsThisMonth,
      roiPct,
      roiSeries,
      leads: (leadsData ?? []) as Lead[],
    };
  } catch {
    // --- Mock fallback (deterministic, good-looking demo) ---
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const daysInMonth = 30;

    const rand = (seed: number) => {
      // simple deterministic PRNG so UI looks consistent
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const series = Array.from({ length: daysInMonth }, (_, i) => {
      const value = Math.round(3000 + rand(i + 1) * 7000); // ₹3k–₹10k/day
      const d = new Date(year, month, i + 1);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      return { date, value };
    });

    const revenueThisMonth = series.reduce((s, p) => s + p.value, 0);
    const leadsThisMonth = 46;
    const bookingsThisMonth = 29;
    const baseline = Math.max(1, revenueThisMonth * 0.55);
    const roiPct = Math.round(((revenueThisMonth - baseline) / baseline) * 100);

    const sources: Lead["source"][] = [
      "WhatsApp",
      "Instagram",
      "Microsite",
      "Referral",
    ];
    const statuses: Lead["status"][] = ["New", "In Progress", "Won", "Lost"];
    const mockLeads: Lead[] = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(year, month, Math.max(1, (i % 20) + 1));
      return {
        id: `mock-${i + 1}`,
        created_at: d.toISOString(),
        name: `Lead ${i + 1}`,
        phone: `+91 98${String(10000000 + i).slice(-8)}`,
        source: sources[i % sources.length],
        status: statuses[i % statuses.length],
        unread: i % 5 === 0,
        note:
          i % 7 === 0
            ? "Asked for weekend slot."
            : i % 9 === 0
            ? "Price negotiation."
            : "",
        value: [0, 0, 499, 799, 999, 1499, 1999][i % 7],
      };
    });

    return {
      slug,
      revenueThisMonth,
      leadsThisMonth,
      bookingsThisMonth,
      roiPct,
      roiSeries: series,
      leads: mockLeads,
    };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const slug = typeof sp?.slug === "string" ? sp.slug : "";

  // Simple auth guard placeholder (optional): if you have RLS + auth cookies wired,
  // you can verify session here and redirect to /login as needed.

  const data = await fetchDashboardData(slug || "demo");

  // Safe telemetry hook (client fires on mount inside LeadTable)
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("vyapr_session_id")?.value || "anon";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Dashboard {data.slug ? `— ${data.slug}` : ""}
          </h1>
          <p className="text-sm text-gray-500">
            Quick view of your growth. Keep the momentum going. ✨
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/inbox?slug=${encodeURIComponent(data.slug)}`}
            className="rounded-xl bg-teal-600 px-4 py-2 text-white shadow hover:bg-teal-700"
          >
            Lead Inbox
          </Link>
          <Link
            href={`/book/${encodeURIComponent(data.slug)}`}
            className="rounded-xl border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Booking Form
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          label="Revenue (This Month)"
          value={`₹${data.revenueThisMonth.toLocaleString("en-IN")}`}
          hint="From confirmed payments"
        />
        <KPICard
          label="Leads (This Month)"
          value={data.leadsThisMonth.toString()}
          hint="Captured across WA/IG/Microsite"
        />
        <KPICard
          label="Bookings (This Month)"
          value={data.bookingsThisMonth.toString()}
          hint="Confirmed slots"
        />
      </div>

      {/* ROI Trend */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              ROI Trend (₹/day)
            </h2>
            <p className="text-xs text-gray-500">
              Compared to baseline, you’re at{" "}
              <span className="font-medium text-teal-700">{data.roiPct}%</span>{" "}
              growth.
            </p>
          </div>
        </div>
        <div className="h-48">
          <TrendChart points={data.roiSeries} />
        </div>
      </div>

      {/* Leads Table */}
      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-0 shadow-sm">
        <Suspense fallback={<div className="p-4 text-sm">Loading leads…</div>}>
          <LeadTable slug={data.slug} sessionId={sessionId} initialLeads={data.leads} />
        </Suspense>
      </div>

      {/* Subtle footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        Teal & Gold theme • No commission • You own your clients
      </div>
    </div>
  );
}
