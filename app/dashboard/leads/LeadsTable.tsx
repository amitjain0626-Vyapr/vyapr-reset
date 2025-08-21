// app/dashboard/leads/LeadsTable.tsx
"use client";

// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";

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

export default function LeadsTable() {
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // Cursors: stack of cursors we used to reach the current page
  // - top of the stack corresponds to CURRENT page's "start position"
  // - when we go next, we push the next_cursor returned by API
  // - when we go prev, we pop (go back to the previous cursor)
  const cursorStackRef = useRef<string[]>([]);

  // For display / disabled states
  const hasPrev = cursorStackRef.current.length > 0;

  const fetchPage = async (cursor: string | null) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        // credentials included automatically for same-origin in browsers
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });

      const json = (await res.json()) as ApiResp;

      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRows(json.data || []);

      // Store the "next" we can go to from this page
      // We DO NOT push anything here; pushing is handled on "Next" click.
      (window as any).__leads_next_cursor__ = json.next_cursor ?? null;
    } catch (e: any) {
      setErr(e?.message || "Failed to load leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNext = async () => {
    // Read the next cursor captured from the last response
    const nextCursor = (window as any).__leads_next_cursor__ || null;
    if (!nextCursor) return;
    // We are moving forward: push the current cursor marker
    // Convention: the top of the stack is the cursor we used to fetch CURRENT page.
    // For the first page, there is no cursor (null). Track it as an empty marker.
    if (cursorStackRef.current.length === 0) {
      cursorStackRef.current.push("NULL"); // marker for the first page
    } else {
      // no-op; stack already tracks current start
    }
    // Now fetch the next page and push its cursor as the new "current start"
    cursorStackRef.current.push(nextCursor);
    await fetchPage(nextCursor);
  };

  const onPrev = async () => {
    if (cursorStackRef.current.length === 0) return;
    // Pop the current page's start cursor
    cursorStackRef.current.pop();
    // Peek the previous page's start cursor (or null if none/marker)
    const prevStart = cursorStackRef.current[cursorStackRef.current.length - 1] ?? "NULL";
    const cursor = prevStart === "NULL" ? null : prevStart;
    await fetchPage(cursor);
  };

  const prettyDate = (iso: string) => {
    try {
      const d = new Date(iso);
      // Show local time; keep it short
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Sorted by <span className="font-medium">Newest first</span>
        </div>
        <div className="flex items-center gap-2">
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
        Showing up to {PAGE_LIMIT} per page. Use Next/Prev to navigate.
      </div>
    </div>
  );
}
