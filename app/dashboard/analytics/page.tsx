// app/dashboard/analytics/page.tsx
"use client";

// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

type AnalyticsResp = {
  ok: boolean;
  data?: {
    window: { fromIso: string; toIso: string };
    kpis: { totalLeads: number; uniquePhones: number; last7Days: number };
    daily: { day: string; count: number }[];
    bySource: { source: string; count: number }[];
  };
  error?: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResp["data"] | null>(null);

  // pull from/to from URL (optional)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/analytics${qs.toString() ? `?${qs.toString()}` : ""}`, {
        cache: "no-store",
      });
      const json: AnalyticsResp = await res.json();
      if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json.data!);
    } catch (e: any) {
      setErr(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const maxY = useMemo(() => {
    if (!data?.daily?.length) return 0;
    return data.daily.reduce((m, d) => Math.max(m, d.count), 0);
  }, [data]);

  // Simple sparkline generator (inline SVG)
  const Sparkline = ({ points }: { points: { day: string; count: number }[] }) => {
    const w = 280;
    const h = 60;
    if (!points.length) return <div className="text-sm text-gray-500">No data</div>;
    const max = Math.max(1, ...points.map((p) => p.count));
    const stepX = w / Math.max(1, points.length - 1);
    const d = points
      .map((p, i) => {
        const x = i * stepX;
        const y = h - (p.count / max) * (h - 6) - 3;
        return `${i === 0 ? "M" : "L"} ${x},${y}`;
      })
      .join(" ");
    return (
      <svg width={w} height={h} className="overflow-visible">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Provider Analytics</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            defaultValue={from}
            onChange={(e) => {
              const p = new URLSearchParams(window.location.search);
              if (e.target.value) p.set("from", e.target.value);
              else p.delete("from");
              const url = `${window.location.pathname}${p.toString() ? `?${p.toString()}` : ""}`;
              history.replaceState(null, "", url);
              // trigger load
              load();
            }}
            className="px-2 py-1.5 rounded-md border text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            defaultValue={to}
            onChange={(e) => {
              const p = new URLSearchParams(window.location.search);
              if (e.target.value) p.set("to", e.target.value);
              else p.delete("to");
              const url = `${window.location.pathname}${p.toString() ? `?${p.toString()}` : ""}`;
              history.replaceState(null, "", url);
              load();
            }}
            className="px-2 py-1.5 rounded-md border text-xs"
            aria-label="To date"
          />
        </div>
      </div>

      {loading && <div className="text-gray-500">Loading…</div>}
      {err && !loading && <div className="text-red-600">{err}</div>}

      {!loading && !err && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Total Leads</div>
              <div className="text-2xl font-semibold">{data.kpis.totalLeads}</div>
              <div className="text-xs text-gray-500 mt-1">
                {fmtDate(data.window.fromIso)} → {fmtDate(data.window.toIso)}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Unique Phones</div>
              <div className="text-2xl font-semibold">{data.kpis.uniquePhones}</div>
              <div className="text-xs text-gray-500 mt-1">Deduped by number</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-500">Leads (Last 7 days)</div>
              <div className="text-2xl font-semibold">{data.kpis.last7Days}</div>
              <div className="text-xs text-gray-500 mt-1">Rolling window</div>
            </div>
          </div>

          {/* Sparkline */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Leads per day (14d)</div>
                <div className="text-xs text-gray-500">
                  Max/day: {maxY}
                </div>
              </div>
            </div>
            <div className="mt-2 text-gray-900">
              <Sparkline points={data.daily} />
            </div>
            <div className="mt-1 grid grid-cols-7 text-[10px] text-gray-500">
              {data.daily.map((d, i) => (
                <div key={d.day + i} className="truncate">{d.day.slice(5)}</div>
              ))}
            </div>
          </div>

          {/* Top sources */}
          <div className="rounded-xl border p-4">
            <div className="text-sm font-medium">Top Sources</div>
            <div className="mt-2 space-y-2">
              {data.bySource.length === 0 && (
                <div className="text-sm text-gray-500">No source data</div>
              )}
              {data.bySource.map((s) => (
                <div key={s.source} className="flex items-center justify-between">
                  <div className="text-sm">{s.source}</div>
                  <div className="text-sm font-medium">{s.count}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
