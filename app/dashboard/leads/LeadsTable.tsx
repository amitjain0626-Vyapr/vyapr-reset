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

/** TUNABLES */
const PAGE_LIMIT = 200;              // fetch more per page to benefit from virtualization
const DEBOUNCE_MS = 400;
const ROW_HEIGHT_PX = 52;            // estimated per-row height (px)
const OVERSCAN_ROWS = 8;             // render a few extra rows above/below the viewport

type QuickRange = "ALL" | "TODAY" | "7D" | "30D";

/** --- mini toast (no deps) --- */
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const show = (text: string, ms = 1800) => {
    setMsg(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), ms);
  };
  const Toast = () =>
    msg ? (
      <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
        <div className="rounded-xl border bg-white/90 backdrop-blur px-4 py-2 text-sm shadow">
          {msg}
        </div>
      </div>
    ) : null;
  return { show, Toast };
}

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
  return dt.toISOString();
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
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const fromIsoRef = useRef<string>("");
  const toIsoRef = useRef<string>("");

  // Cursors (Prev/Next)
  const cursorStackRef = useRef<string[]>([]);
  const hasPrev = cursorStackRef.current.length > 0;

  // Toast
  const { show, Toast } = useToast();

  // Virtualization refs/state
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportH, setViewportH] = useState<number>(0);

  const computeIsoWindow = () => {
    let fromIso = "";
    let toIso = "";
    if (quick === "TODAY") {
      fromIso = toIsoZ(startOfLocalDay(new Date()));
      toIso = toIsoZ(endOfLocalDay(new Date()));
    } else if (quick === "7D") {
      const now = new Date();
      const start = startOfLocalDay(new Date(now.getTime() - 6 * 24 * 3600 * 1000));
      fromIso = toIsoZ(start);
      toIso = toIsoZ(endOfLocalDay(now));
    } else if (quick === "30D") {
      const now = new Date();
      const start = startOfLocalDay(new Date(now.getTime() - 29 * 24 * 3600 * 1000));
      fromIso = toIsoZ(start);
      toIso = toIsoZ(endOfLocalDay(now));
    } else if (quick === "ALL") {
      if (fromDate) fromIso = toIsoZ(startOfLocalDay(new Date(fromDate + "T00:00:00")));
      if (toDate) toIso = toIsoZ(endOfLocalDay(new Date(toDate + "T00:00:00")));
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
      if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setRows(json.data || []);
      (window as any).__leads_next_cursor__ = json.next_cursor ?? null;

      // Reset scroll position on any new load
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        setScrollTop(0);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load leads");
      setRows([]);
      (window as any).__leads_next_cursor__ = null;
      show("Couldn’t load leads. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => {
      const trimmed = query.trim();
      if (debouncedQueryRef.current !== trimmed) {
        debouncedQueryRef.current = trimmed;
        cursorStackRef.current = [];
      }
      fetchPage(null);
    }, DEBOUNCE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Date filters
  useEffect(() => {
    cursorStackRef.current = [];
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, fromDate, toDate]);

  // Observe container height
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Handle scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const onNext = async () => {
    const nextCursor = (window as any).__leads_next_cursor__ || null;
    if (!nextCursor) return;
    if (cursorStackRef.current.length === 0) cursorStackRef.current.push("NULL");
    cursorStackRef.current.push(nextCursor);
    await fetchPage(nextCursor);
  };

  const onPrev = async () => {
    if (cursorStackRef.current.length === 0) return;
    cursorStackRef.current.pop();
    const prevStart = cursorStackRef.current[cursorStackRef.current.length - 1] ?? "NULL";
    await fetchPage(prevStart === "NULL" ? null : prevStart);
  };

  const onPickQuick = (val: QuickRange) => {
    setQuick(val);
    if (val !== "ALL") {
      setFromDate("");
      setToDate("");
    }
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

  const onCopyPhone = async (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, "");
    try {
      await navigator.clipboard.writeText(cleaned);
      show("Phone copied");
    } catch {
      show("Copy failed");
    }
  };

  const total = rows?.length || 0;
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
  const visibleCount = Math.ceil((viewportH || 0) / ROW_HEIGHT_PX) + OVERSCAN_ROWS * 2;
  const end = Math.min(total, firstVisible + visibleCount);
  const slice = rows?.slice(firstVisible, end) ?? [];

  const topPad = firstVisible * ROW_HEIGHT_PX;
  const bottomPad = Math.max(0, (total - end) * ROW_HEIGHT_PX);

  const empty = !loading && total === 0;
  const isActive = (k: QuickRange) => quick === k && (k !== "ALL" || (!fromDate && !toDate));

  return (
    <div className="space-y-3">
      {/* Toast */}
      <Toast />

      {/* Controls */}
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
                title={
                  k === "ALL"
                    ? "All time (or custom dates)"
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

          {/* Custom dates */}
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
            <button type="button" onClick={() => setQuick("ALL")} className="px-2 py-1.5 rounded-md border text-xs">
              Apply
            </button>
            {(fromDate || toDate) && (
              <button type="button" onClick={() => { setFromDate(""); setToDate(""); setQuick("ALL"); }} className="px-2 py-1.5 rounded-md border text-xs">
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
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={loading || !(window as any).__leads_next_cursor__}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Table (virtualized body) */}
      <div ref={scrollRef} className="rounded-xl border max-h-[70vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
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

            {!loading && !err && empty && (
              <tr>
                <td className="px-3 py-6 text-gray-500" colSpan={4}>
                  No leads yet. Try clearing filters or create a test lead from the booking page.
                </td>
              </tr>
            )}

            {/* Top spacer */}
            {!loading && !err && !empty && topPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={4} style={{ height: `${topPad}px`, padding: 0, border: 0 }} />
              </tr>
            )}

            {/* Visible slice */}
            {!loading &&
              !err &&
              slice.map((r) => (
                <tr key={r.id} className="border-t" style={{ height: ROW_HEIGHT_PX }}>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.patient_name || <span className="text-gray-400">Unnamed</span>}
                    </div>
                    {r.note && <div className="text-gray-500 line-clamp-1">{r.note}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {r.phone ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://wa.me/${r.phone.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                          title="Open in WhatsApp"
                        >
                          {r.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => onCopyPhone(r.phone!)}
                          className="px-2 py-0.5 rounded border text-xs"
                          title="Copy phone"
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="line-clamp-1">{r.note || "—"}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{prettyDate(r.created_at)}</td>
                </tr>
              ))}

            {/* Bottom spacer */}
            {!loading && !err && !empty && bottomPad > 0 && (
              <tr aria-hidden="true">
                <td colSpan={4} style={{ height: `${bottomPad}px`, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500">
        Virtualized view: rendering ~{visibleCount} rows at a time (of {total}). Page size {PAGE_LIMIT}.
      </div>
    </div>
  );
}
