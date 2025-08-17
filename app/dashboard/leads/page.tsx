// app/dashboard/leads/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  patient_name: string;
  phone: string;
  status: "new" | "contacted" | "closed" | string;
  source: string;
  created_at: string;
  note: string | null;
  source_slug?: string | null;
};

type HistoryRow = {
  id: string;
  lead_id: string;
  action: "status_change" | "note_update" | string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor: string | null;
};

function normalizePhone(p: string) {
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits;
}

function waLink(name: string, phone: string, slug?: string | null) {
  const to = normalizePhone(phone).replace(/^\+/, "");
  const text = `Hi ${name || ""}, I'm contacting you about my appointment request via Vyapr ${
    slug ? `(/${slug})` : ""
  }.`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export default function LeadsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Lead[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState<Record<string, boolean>>({});

  // history modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<Lead | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

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
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRows(json.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Couldn’t load leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, next: Lead["status"]) {
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/update-status", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    } catch (e: any) {
      alert(e?.message || "Could not update status");
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(id: string, note: string) {
    setNoteBusy((b) => ({ ...b, [id]: true }));
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, note } : r)));
    try {
      const res = await fetch("/api/leads/update-note", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setRows(prev);
      alert(e?.message || "Could not save note");
    } finally {
      setNoteBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function openHistory(lead: Lead) {
    setHistoryFor(lead);
    setHistoryRows([]);
    setHistoryErr(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/leads/history?id=${encodeURIComponent(lead.id)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setHistoryRows(json.rows || []);
    } catch (e: any) {
      setHistoryErr(e?.message || "Couldn’t fetch history");
    } finally {
      setHistoryLoading(false);
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
        <button onClick={load} className="border rounded-md px-3 py-2 text-sm">
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
                <th className="border px-2 py-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const telHref = `tel:${normalizePhone(lead.phone)}`;
                const waHref = waLink(lead.patient_name || "there", lead.phone, lead.source_slug);

                return (
                  <tr key={lead.id}>
                    <td className="border px-2 py-1">{lead.patient_name}</td>
                    <td className="border px-2 py-1">{normalizePhone(lead.phone)}</td>
                    <td className="border px-2 py-1 capitalize">{lead.status}</td>
                    <td className="border px-2 py-1">{lead.source}</td>
                    <td className="border px-2 py-1">
                      {new Date(lead.created_at).toLocaleString()}
                    </td>

                    {/* Editable Note */}
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        className="w-full border rounded-md px-2 py-1 text-sm"
                        value={lead.note || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((rs) => rs.map((r) => (r.id === lead.id ? { ...r, note: v } : r)));
                        }}
                        onBlur={(e) => saveNote(lead.id, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                      {noteBusy[lead.id] ? (
                        <div className="mt-1 text-[11px] text-gray-500">Saving…</div>
                      ) : null}
                    </td>

                    <td className="border px-2 py-1">
                      <div className="flex flex-wrap gap-2">
                        <a href={telHref} className="border rounded-md px-2 py-1" title="Call">
                          Call
                        </a>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border rounded-md px-2 py-1"
                          title="WhatsApp"
                        >
                          WhatsApp
                        </a>
                        <button
                          disabled={busyId === lead.id || lead.status === "contacted"}
                          onClick={() => updateStatus(lead.id, "contacted")}
                          className="border rounded-md px-2 py-1 disabled:opacity-50"
                          title="Mark Contacted"
                        >
                          Mark Contacted
                        </button>
                        <button
                          disabled={busyId === lead.id || lead.status === "closed"}
                          onClick={() => updateStatus(lead.id, "closed")}
                          className="border rounded-md px-2 py-1 disabled:opacity-50"
                          title="Close"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => openHistory(lead)}
                          className="border rounded-md px-2 py-1"
                          title="View history"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                History — {historyFor?.patient_name} ({normalizePhone(historyFor?.phone || "")})
              </h2>
              <button className="text-sm" onClick={() => setHistoryOpen(false)}>
                Close
              </button>
            </div>

            {historyLoading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : historyErr ? (
              <div className="text-sm text-red-600">Error — {historyErr}</div>
            ) : historyRows.length === 0 ? (
              <div className="text-sm text-gray-600">No history yet.</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1 text-left">When</th>
                      <th className="border px-2 py-1 text-left">Action</th>
                      <th className="border px-2 py-1 text-left">Old</th>
                      <th className="border px-2 py-1 text-left">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h) => (
                      <tr key={h.id}>
                        <td className="border px-2 py-1">
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                        <td className="border px-2 py-1">{h.action}</td>
                        <td className="border px-2 py-1 whitespace-pre-wrap">
                          {h.old_value || ""}
                        </td>
                        <td className="border px-2 py-1 whitespace-pre-wrap">
                          {h.new_value || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
