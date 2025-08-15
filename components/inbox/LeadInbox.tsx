// @ts-nocheck
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";

type Lead = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  created_at: string;
};

function formatDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(+d) ? s! : d.toLocaleString();
}

export default function LeadInbox({ slug }: { slug: string }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({
        slug, page: String(page), limit: String(limit),
      });
      if (q) params.set("q", q);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/leads/list?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setErr(e.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [slug, q, from, to, page, limit]);

  useEffect(() => { setPage(1); }, [q, from, to]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  return (
    <div className="space-y-4">
      {/* Search + Dates */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Search (name or phone)</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Riya or +91…"
            className="mt-1 w-full rounded-xl border p-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border p-2" />
        </div>
        <div>
          <label className="text-sm font-medium">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border p-2" />
        </div>
      </div>

      {err && <ErrorNotice title="Couldn’t load leads" message={err} retry={fetchLeads} />}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {!loading && rows.length === 0 && <div className="text-sm opacity-70">No leads found.</div>}
        {rows.map((l) => (
          <div key={l.id} className="rounded-2xl border p-3 shadow-sm bg-white">
            <div className="font-semibold">{l.patient_name || "—"}</div>
            <div className="text-sm text-gray-600">{l.phone || "—"}</div>
            {l.note && <div className="mt-1 text-sm">{l.note}</div>}
            <div className="mt-1 text-xs text-gray-400">Created: {formatDate(l.created_at)}</div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-3 py-3" colSpan={4}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td className="px-3 py-3 text-gray-500" colSpan={4}>No leads found.</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-medium">{l.patient_name || "—"}</td>
                <td className="px-3 py-2">{l.phone || "—"}</td>
                <td className="px-3 py-2">{formatDate(l.created_at)}</td>
                <td className="px-3 py-2 max-w-[320px] truncate" title={l.note || ""}>{l.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</div>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border px-3 py-1.5 disabled:opacity-50">Prev</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded-xl border px-3 py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
