// app/dashboard/leads/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

/* ---------- types & helpers ---------- */

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

type LeadHistory = {
  id: string;
  type: string;
  detail?: string | null;
  created_at: string;
};

function normalizePhone(p: string) {
  const digits = (p || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits;
}

function waLink(name: string, phone: string, slug?: string | null) {
  const to = normalizePhone(phone).replace(/^\+/, "");
  const text = `Hi ${name || ""}, I'm contacting you about my appointment request via Vyapr${
    slug ? ` (/d/${slug})` : ""
  }.`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/* ---------- page ---------- */

export default function LeadsPage() {
  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // table state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Lead[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // inline note edits (leadId -> note string)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteBusy, setNoteBusy] = useState<string | null>(null);

  // history panel
  const [histOpenFor, setHistOpenFor] = useState<string | null>(null);
  const [histLead, setHistLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const params = useMemo(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (status) u.set("status", status);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    return u.toString();
  }, [q, status, from, to]);

  /* ---------- data ---------- */

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
      const items: Lead[] = json.rows || [];
      setRows(items);
      // seed note drafts from server values
      const seed: Record<string, string> = {};
      for (const r of items) seed[r.id] = r.note || "";
      setNoteDrafts(seed);
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

  /* ---------- actions ---------- */

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

  async function saveNote(id: string) {
    const draft = noteDrafts[id] ?? "";
    setNoteBusy(id);
    try {
      const res = await fetch("/api/leads/update-note", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const updated: Lead = json.lead;
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, note: updated.note } : r)));
      // toast-lite
      console.log("Note saved");
    } catch (e: any) {
      alert(e?.message || "Could not update note");
    } finally {
      setNoteBusy(null);
    }
  }

  async function openHistory(id: string) {
    setHistOpenFor(id);
    setHistLead(null);
    setHistory([]);
    setHistErr(null);
    setHistLoading(true);

    try {
      const res = await fetch(`/api/leads/history?id=${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setHistLead(json.lead || null);
      setHistory(json.history || []);
    } catch (e: any) {
      setHistErr(e?.message || "Could not load history");
    } finally {
      setHistLoading(false);
    }
  }

  /* ---------- render ---------- */

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
                const draft = noteDrafts[lead.id] ?? (lead.note || "");

                return (
                  <tr key={lead.id}>
                    <td className="border px-2 py-1">{lead.patient_name}</td>
                    <td className="border px-2 py-1">{normalizePhone(lead.phone)}</td>
                    <td className="border px-2 py-1 capitalize">{lead.status}</td>
                    <td className="border px-2 py-1">{lead.source}</td>
                    <td className="border px-2 py-1">
                      {new Date(lead.created_at).toLocaleString()}
                    </td>

                    {/* NOTE editor */}
                    <td className="border px-2 py-1 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={draft}
                          onChange={(e) =>
                            setNoteDrafts((m) => ({ ...m, [lead.id]: e.target.value }))
                          }
                          placeholder="Add a note…"
                        />
                        <button
                          className="border rounded px-2 py-1"
                          disabled={noteBusy === lead.id}
                          onClick={() => saveNote(lead.id)}
                          title="Save note"
                        >
                          {noteBusy === lead.id ? "…" : "Save"}
                        </button>
                      </div>
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
                          className="border rounded-md px-2 py-1"
                          onClick={() => openHistory(lead.id)}
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

      {/* History panel */}
      {histOpenFor && (
        <div className="mt-6 rounded-lg border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">
              History — {histLead?.patient_name} ({normalizePhone(histLead?.phone || "")})
            </div>
            <button
              className="border rounded px-2 py-1"
              onClick={() => {
                setHistOpenFor(null);
                setHistLead(null);
                setHistory([]);
                setHistErr(null);
              }}
            >
              Close
            </button>
          </div>
          {histLoading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : histErr ? (
            <div className="text-sm text-red-600">Error — {histErr}</div>
          ) : (
            <div className="text-sm">
              {history.length === 0 ? (
                <div>No timeline yet.</div>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className="opacity-70 mr-2">
                        {new Date(h.created_at).toLocaleString()}:
                      </span>
                      <span className="font-medium">{h.type}</span>
                      {h.detail ? <span className="opacity-80"> — {h.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
