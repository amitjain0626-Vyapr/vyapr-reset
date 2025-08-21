// app/dashboard/leads/LeadsTable.tsx
"use client";

// @ts-nocheck
import { useEffect, useRef, useState } from "react";

type Lead = {
  id: string;
  created_at: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  provider_id: string | null;
};

type ApiResp = {
  ok: boolean;
  data: Lead[];
  next_cursor: string | null;
  has_more: boolean;
  error?: string;
};

const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 400;

type QuickRange = "ALL" | "TODAY" | "7D" | "30D";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toIsoZ(dt: Date) {
  return dt.toISOString(); // UTC ISO; server expects ISO; DB is in UTC
}

export default function LeadsTable() {
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState<string>("");
  const debouncedQueryRef = useRef<string>("");

  // Date filters
  const [quick, setQuick] = useState<QuickRange>("ALL");
  const [fromDate, setFromDate] = useState<string>(""); // yyyy-mm-dd (local)
  const [toDate, setToDate] = useState<string>("");     // yyyy-mm-dd (local)
  const fromIsoRef = useRef<string>(""); // computed ISO for API
  const toIsoRef = useRef<string>("");   // computed ISO for API

  // Cursor stack for Prev/Next
  const cursorStackRef = useRef<string[]>([]);
  const hasPrev = cursorStackRef.current.length > 0;

  const computeIsoWindow = () => {
    let fromIso = "";
    let toIso = "";

    if (quick === "TODAY") {
      fromIso = toIsoZ(startOfLocalDay(new Date()));
      toIso = toIsoZ(endOfLocalDay(new Date()));
    } else if (quick === "7D") {
      const now = new Date();
      const start = startOfLocalDay(new Date(now.getTime() - 6 * 24 * 3600 * 1000)); // inclusive 7 days window
      fromIso = toIsoZ(start);
      toIso = toIsoZ(endOfLocalDay(now));
    } else if (quick === "30D") {
      const now = new Date();
      const start = startOfLocalDay(new Date(now.getTime() - 29 * 24 * 3600 * 1000));
      fromIso = toIsoZ(start);
      toIso = toIsoZ(endOfLocalDay(now));
    } else if (quick === "ALL") {
      // If user picked custom dates, respect them
      if (fromDate) {
        const s = startOfLocalDay(new Date(fromDate + "T00:00:00"));
        fromIso = toIsoZ(s);
      }
      if (toDate) {
        const e = endOfLocalDay(new Date(toDate + "T00:00:00"));
        toIso = toIsoZ(e);
      }
    }

    fromIsoRef.current = fromIso;
    toIsoRef.current = toIso;
  };

  const fetchPage = async (cursor: string | null) => {
    setLoading(true);
    setErr(null);
    try {
      computeIsoWindow();

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);

      const q = debouncedQueryRef.current.trim();
      if (q) params.set("query", q);

      if (fromIsoRef.current) params.set("from", fromIsoRef.current);
      if (toIsoRef.current) params.set("to", toIsoRef.current);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = (await res.json()) as ApiResp;
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRows(json.data || []);
      (window as any).__leads_next_cursor__ = json.next_cursor ?? null;
    } catch (e: any) {
      setErr(e?.message || "Failed to load leads");
      setRows([]);
      (window as any).__leads_next_cursor__ = null;
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => {
      const trimmed = query.trim();
      if (debouncedQueryRef.current !== trimmed) {
        debouncedQueryRef.current = trimmed;
        cursorStackRef.current = []; // reset to page 1 for new search
      }
      fetchPage(null);
    }, DEBOUNCE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // React on quick range / custom dates
  useEffect(() => {
    // Any change in date filters resets pagination to page 1
    cursorStackRef.current = [];
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, fromDate, toDate]);

  const onNext = async () => {
    const nextCursor = (window as any).__leads_next_cursor__ || null;
    if (!nextCursor) return;
    if (cursorStackRef.current.length === 0) {
      cursorStackRef.current.push("NULL");
    }
    cursorStackRef.current.push(nextCursor);
    await fetchPage(nextCursor);
  };

  const onPrev = async () => {
    if (cursorStackRef.current.length === 0) return;
    cursorStackRef.current.pop();
    const prevStart = cursorStackRef.current[cursorStackRef.current.length - 1] ?? "NULL";
    const cursor = prevStart === "NULL" ? null : prevStart;
    await fetchPage(cursor);
  };

  const onPickQuick = (val: QuickRange) => {
    setQuick(val);
    // When using quick ranges, clear custom fields for clarity
    if (val !== "ALL") {
      setFromDate("");
      setToDate("");
    }
  };

  const onApplyCustom = () => {
    setQuick("ALL"); // "ALL" honors custom dates if present
  };

  const onClearDates = () => {
    setFromDate("");
    setToDate("");
    setQuick("ALL");
  };

  const prettyDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const empty = !loading && rows && rows.length === 0;

  const isActive = (k: QuickRange) =>
    quick === k && (k !== "ALL" || (!fromDate && !toDate));

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-500">
          Sorted by <span className="font-medium">Newest first</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or phone…"
            className="px-3 py-1.5 rounded-md border text-sm w-64"
            aria-label="Search leads"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="px-2 py-1.5 rounded-md border text-xs"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}

          {/* Quick ranges */}
          <div className="flex items-center gap-1 ml-2">
            {(["ALL", "TODAY", "7D", "30D"] as QuickRange[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onPickQuick(k)}
                className={`px-2.5 py-1.5 rounded-md border text-xs ${
                  isActive(k) ? "bg-gray-900 text-white" : ""
                }`}
                aria-label={`Range ${k}`}
                title={
                  k === "ALL"
                    ? "All time (or custom dates, if set)"
                    : k === "TODAY"
                    ? "Today"
                    : k === "7D"
                    ? "Last 7 days"
                    : "Last 30 days"
                }
              >
                {k}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs"
              aria-label="From date"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs"
              aria-label="To date"
            />
            <button
              type="button"
              onClick={onApplyCustom}
              className="px-2 py-1.5 rounded-md border text-xs"
            >
              Apply
            </button>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={onClearDates}
                className="px-2 py-1.5 rounded-md border text-xs"
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Prev/Next */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev || loading}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 ml-2"
            aria-label="Previous page"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={loading || !(window as any).__leads_next_cursor__}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-[40%]">Patient</th>
              <th className="px-3 py-2 w-[20%]">Phone</th>
              <th className="px-3 py-2 w-[30%]">Note</th>
              <th className="px-3 py-2 w-[10%]">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-3 text-gray-500" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {err && !loading && (
              <tr>
                <td className="px-3 py-3 text-red-600" colSpan={4}>
                  {err}
                </td>
              </tr>
            )}
            {!loading &&
              !err &&
              rows?.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-gray-500" colSpan={4}>
                    No leads found.
                  </td>
                </tr>
              )}
            {!loading &&
              !err &&
              rows?.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.patient_name || <span className="text-gray-400">Unnamed</span>}
                    </div>
                    {r.note && <div className="text-gray-500">{r.note}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {r.phone ? (
                      <a
                        href={`https://wa.me/${r.phone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                        title="Open in WhatsApp"
                      >
                        {r.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="line-clamp-2">{r.note || "—"}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{prettyDate(r.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500">
        Showing up to {PAGE_LIMIT} per page. Search is debounced ({DEBOUNCE_MS}ms).
        Ranges: All / Today / 7d / 30d, or pick custom dates and press Apply.
      </div>
    </div>
  );
}
