// components/roi/RoiTrackerClient.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
      .format(Math.max(0, Math.round(n)));
  } catch {
    return `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;
  }
}

const DEPLOY_BASE = "https://vyapr-reset-5rly.vercel.app";
const PROVIDER_SLUG = "amitjain0626";
const TEST_LEAD_ID = "22dfd131-9bb5-4072-a177-4417585a84c0";
const TEST_WA_PHONE = "919873284544";

// Generic team line across all categories
const PROVIDER_TEAM_LINE = "your service provider’s team";

export default function RoiTrackerClient() {
  const [data, setData] = useState<{
    today:number; last7:number; last30:number; mtd:number; lmtd:number;
    deltaPct:number|null; pending:number;
    leads30:number; bookings30:number; paid30:number;
    conv?: { overall:number|null; l2b:number|null; b2p:number|null };
  } | null>(null);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/roi/summary", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        if (!res.ok || json?.ok !== true) {
          setErr(json?.error || "failed");
        } else {
          setData(json);
        }
      } catch {
        if (mounted) setErr("network");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const amount = data?.pending || 0;
  const payLink = useMemo(() => {
    const q = new URLSearchParams({
      slug: PROVIDER_SLUG,
      amount: String(amount || 0),
      utm_source: "dashboard",
      utm_medium: "cta",
      utm_campaign: "pending_collect"
    }).toString();
    return `${DEPLOY_BASE}/pay/${TEST_LEAD_ID}?${q}`;
  }, [amount]);

  const waCollectURL = useMemo(() => {
    const text = [
      `Hi, this is ${PROVIDER_TEAM_LINE}.`,
      amount > 0 ? `A quick reminder — you have a pending payment of ${fmtINR(amount)}.` : `A quick payment reminder.`,
      `You can complete it securely here: ${payLink}`
    ].join(" ");
    return `https://wa.me/${TEST_WA_PHONE}?text=${encodeURIComponent(text)}`;
  }, [amount, payLink]);

  const boostURL = useMemo(() => {
    return `${DEPLOY_BASE}/settings?tab=boost&utm_source=dashboard&utm_medium=cta&utm_campaign=boost_visibility`;
  }, []);

  if (err) return null;

  // skeleton
  if (!data) {
    return (
      <div className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 p-4 bg-white animate-pulse h-20" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="h-10 w-40 rounded-xl bg-gray-200 animate-pulse" />
          <div className="h-10 w-40 rounded-xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  const convOverall = data?.conv?.overall ?? null;
  const stats = [
    { label: "Today", value: fmtINR(data.today), sub: "Since midnight IST" },
    { label: "7D", value: fmtINR(data.last7), sub: "Last 7 days (rolling)" },
    { label: "30D", value: fmtINR(data.last30), sub: "Last 30 days (rolling)" },
    { label: "MTD", value: fmtINR(data.mtd), sub: "Month-to-date (IST)" },
    { label: "LMTD", value: fmtINR(data.lmtd), sub: "Last month to date" },
    { label: "Pending ₹", value: fmtINR(data.pending || 0), sub: "Unpaid bookings" },
    {
      label: "Conversion %",
      value: convOverall == null ? "—" : `${convOverall}%`,
      sub: `L→B ${data?.conv?.l2b ?? "—"}% • B→P ${data?.conv?.b2p ?? "—"}%`,
    },
  ];

  return (
    <div className="mb-6">
      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-white">
            <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold">{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* MTD vs LMTD note */}
      <div className="mt-2 text-sm text-gray-600">
        {data.deltaPct == null ? (
          <span className="italic">MTD vs LMTD: not enough data last month.</span>
        ) : (
          <span>
            MTD vs LMTD:{" "}
            <span className={data.deltaPct >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
              {data.deltaPct >= 0 ? "+" : ""}{data.deltaPct}%
            </span>
          </span>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={waCollectURL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 transition"
          aria-label="Collect pending payments on WhatsApp"
        >
          💬 Collect pending payments
        </a>
        <a
          href={boostURL}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-600 px-4 py-2 text-indigo-700 bg-white hover:bg-indigo-50 transition"
          aria-label="Boost visibility"
        >
          🚀 Boost visibility
        </a>
      </div>
    </div>
  );
}
