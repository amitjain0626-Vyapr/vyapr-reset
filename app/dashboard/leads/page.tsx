// app/dashboard/leads/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  patient_name: string;
  phone: string;
  status: string;
  source: string;
  created_at: string;
  note: string | null;
  source_slug?: string | null;
  dentist_id?: string | null;
};

export default function LeadsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Lead[]>([]);

  const params = useMemo(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (status) u.set("status", status);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    return u.toString();
  }, [q, status, from, to]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/list${params ? `?${params}` : ""}`, {
        method: "GET",
        credentials: "include",          // ✅ send auth cookies
        cache: "no-store",               // ✅ always fresh
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setRows(json.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Couldn’t load leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">Lead Inbox</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="border rounded-md px-3 py-2 text-sm"
          placeholder="Search (name or phone)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Status: All</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
        <input
          type="date"
          className="border rounded-md px-3 py-2 text-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="From"
        />
        <input
          type="date"
          className="border rounded-md px-3 py-2 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="To"
        />
        <button
          onClick={load}
          className="border rounded-md px-3 py-2 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Status / errors */}
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : err ? (
        <div className="text-sm text-red-600">Couldn’t load leads — {err}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-600">No leads found.</div>
      ) : null}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Name</th>
                <th className="border px-2 py-1 text-left">Phone</th>
                <th className="border px-2 py-1 text-left">Status</th>
                <th className="border px-2 py-1 text-left">Source</th>
                <th className="border px-2 py-1 text-left">Created</th>
                <th className="border px-2 py-1 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id}>
                  <td className="border px-2 py-1">{lead.patient_name}</td>
                  <td className="border px-2 py-1">{lead.phone}</td>
                  <td className="border px-2 py-1">{lead.status}</td>
                  <td className="border px-2 py-1">{lead.source}</td>
                  <td className="border px-2 py-1">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                  <td className="border px-2 py-1">{lead.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
