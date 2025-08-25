// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
      .format(Math.max(0, Math.round(n)));
  } catch {
    return `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;
  }
}

export default function RoiTrackerClient() {
  const [data, setData] = useState<{today:number;last7:number;last30:number;mtd:number;lmtd:number;deltaPct:number|null} | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/roi/summary", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        if (!res.ok || !json?.ok) {
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

  if (err) return null;
  if (!data) {
    // lightweight skeleton
    return (
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 p-4 bg-white animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Today", value: fmtINR(data.today), sub: "Since midnight IST" },
    { label: "7D", value: fmtINR(data.last7), sub: "Last 7 days (rolling)" },
    { label: "30D", value: fmtINR(data.last30), sub: "Last 30 days (rolling)" },
    { label: "MTD", value: fmtINR(data.mtd), sub: "Month-to-date (IST)" },
    { label: "LMTD", value: fmtINR(data.lmtd), sub: "Last month to date" },
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
    </div>
  );
}
