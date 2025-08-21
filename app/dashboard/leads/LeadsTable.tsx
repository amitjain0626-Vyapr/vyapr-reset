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

export default function LeadsTable() {
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState<string>("");
  const debouncedQueryRef = useRef<string>("");

  // Cursor stack to support Prev/Next
  const cursorStackRef = useRef<string[]>([]);
  const hasPrev = cursorStackRef.current.length > 0;

  const fetchPage = async (cursor: string | null, activeQuery: string) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);
      if (activeQuery) params.set("query", activeQuery);

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
    fetchPage(null, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search input
  useEffect(() => {
    const h = setTimeout(() => {
      const trimmed = query.trim();
      // If search term changed vs last debounced, reset pagination
      if (debouncedQueryRef.current !== trimmed) {
        debouncedQueryRef.current = trimmed;
        cursorStackRef.current = []; // reset to first page for a new query
      }
      fetchPage(null, debouncedQueryRef.current);
    }, DEBOUNCE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onNext = async () => {
    const nextCursor = (window as any).__leads_next_cursor__ || null;
    if (!nextCursor) return;

    // Track that current page is at a start cursor; for first page, we store a "NULL" marker
    if (cursorStackRef.current.length === 0) {
      cursorStackRef.current.push("NULL");
    }
    cursorStackRef.current.push(nextCursor);
    await fetchPage(nextCursor, debouncedQueryRef.current);
  };

  const onPrev = async () => {
    if (cursorStackRef.current.length === 0) return;
    cursorStackRef.current.pop();
    const prevStart = cursorStackRef.current[cursorStackRef.current.length - 1] ?? "NULL";
    const cursor = prevStart === "NULL" ? null : prevStart;
    await fetchPage(cursor, debouncedQueryRef.current);
  };

  const onClear = () => {
    setQuery("");
    // debounced effect will reset and reload page 1
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

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-500">
          Sorted by <span className="font-medium">Newest first</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="flex items-center gap-2">
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
                onClick={onClear}
                className="px-2 py-1.5 rounded-md border text-xs"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Prev/Next */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev || loading}
            className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50"
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
            {empty && (
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

      {/* Footer info */}
      <div className="text-xs text-gray-500">
        Showing up to {PAGE_LIMIT} per page. Search is debounced ({DEBOUNCE_MS}ms). Use Next/Prev to navigate.
      </div>
    </div>
  );
}
