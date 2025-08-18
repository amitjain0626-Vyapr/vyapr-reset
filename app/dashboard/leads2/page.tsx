// app/dashboard/leads2/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Lead = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  status: string | null;
  source: string | null;
  created_at: string;
  note: string | null;
};

function normalizePhone(p?: string | null) {
  if (!p) return "";
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits;
}

function waLink(name: string, phone: string, slug?: string) {
  const to = normalizePhone(phone);
  const text = encodeURIComponent(
    `Hi${name ? " " + name : ""}! This is Amit from Vyapr. Following up on your request${slug ? ` for ${slug}` : ""}.`
  );
  return `https://wa.me/${to.replace("+", "")}?text=${text}`;
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeadsPageV2() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<"all" | "new" | "contacted" | "closed">("all");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const closeModal = useCallback(() => setModalLead(null), []);

  useEffect(() => {
    try {
      const original = window.alert;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      window.alert = function () { console.warn("[vyapr] alert() blocked by leads2"); };
      return () => { window.alert = original; };
    } catch {}
  }, []);

  // Load via server API (ensures auth cookies used)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/leads/list", { credentials: "include" });
      const json = await res.json();
      if (!alive) return;
      setLeads(res.ok ? (json.leads || json.rows || []) : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => (l.status || "new").toLowerCase() === filter);
  }, [leads, filter]);

  async function openModalWithHistory(id: string) {
    const res = await fetch(`/api/leads/history?id=${id}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok) { console.error("Failed to load history:", json); return; }
    setModalLead(json.lead as Lead);
  }

  async function onSaveNote(lead: Lead, note: string) {
    setSavingId(lead.id);
    try {
      const res = await fetch("/api/leads/update-note", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: lead.id, note }),
      });
      const json = await res.json();
      if (!res.ok) { console.error("Failed to save note:", json); return; }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, note: json.note } : l)));
      if (modalLead?.id === lead.id) setModalLead({ ...modalLead, note: json.note });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads V2 (Modal Build)</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-gray-100 border">build: leads2</span>
          <label className="text-sm text-gray-600">Filter:</label>
          <select className="border rounded px-2 py-1" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading leads…</div>
      ) : visible.length === 0 ? (
        <div className="text-gray-500">No leads yet.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Patient</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Note</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="p-3">{new Date(lead.created_at).toLocaleString()}</td>
                  <td className="p-3">{lead.patient_name || "—"}</td>
                  <td className="p-3">
                    {lead.phone ? (
                      <a className="underline" href={waLink(lead.patient_name || "", lead.phone)} target="_blank" rel="noreferrer">
                        {normalizePhone(lead.phone)}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="p-3 capitalize">{lead.status || "new"}</td>
                  <td className="p-3">{lead.note || "—"}</td>
                  <td className="p-3">
                    <button className="px-3 py-1 rounded border" onClick={() => openModalWithHistory(lead.id)}>
                      OPEN MODAL ✅
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
             onClick={(e) => { if (e.target === e.currentTarget) setModalLead(null); }}>
          <div className="bg-white rounded-xl shadow-lg w-[560px] max-w-[94vw] p-6">
            <h2 className="text-lg font-semibold mb-4">Lead Details (Modal)</h2>
            <div className="space-y-1 text-sm">
              <p><b>Patient:</b> {modalLead.patient_name || "—"}</p>
              <p><b>Phone:</b> {modalLead.phone || "—"}</p>
              <p><b>Status:</b> {modalLead.status || "—"}</p>
              <p><b>Created:</b> {new Date(modalLead.created_at).toLocaleString()}</p>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Note</label>
              <textarea
                className="w-full border rounded p-2"
                rows={4}
                defaultValue={modalLead.note || ""}
                onBlur={(e) => onSaveNote(modalLead, e.target.value)}
                disabled={savingId === modalLead.id}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={() => setModalLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
