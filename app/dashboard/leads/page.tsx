// app/dashboard/leads/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string>("");

  // Modal state
  const [modalLead, setModalLead] = useState<Lead | null>(null);

  // Fetch leads
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("Leads")
        .select("id, patient_name, phone, status, source, created_at, note")
        .order("created_at", { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error(error.message);
        setLeads([]);
      } else {
        setLeads(data || []);
      }
      setLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => (l.status || "new").toLowerCase() === filter);
  }, [leads, filter]);

  async function openHistory(id: string) {
    const res = await fetch(`/api/leads/history?id=${id}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to load history");
      return;
    }
    setModalLead(json.lead as Lead);
  }

  async function onSaveNote(lead: Lead, note: string) {
    setSavingId(lead.id);
    const res = await fetch("/api/leads/update-note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: lead.id, note }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      alert(json?.error || "Failed to save note");
      return;
    }
    // Update dashboard + modal
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, note: json.note } : l)));
    if (modalLead?.id === lead.id) setModalLead({ ...modalLead, note: json.note });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Filter:</label>
          <select
            className="border rounded px-2 py-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div>Loading leads…</div>
      ) : visible.length === 0 ? (
        <div>No leads yet.</div>
      ) : (
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">When</th>
              <th className="p-2 text-left">Patient</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Note</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((lead) => (
              <tr key={lead.id} className="border-t">
                <td className="p-2">{new Date(lead.created_at).toLocaleString()}</td>
                <td className="p-2">{lead.patient_name || "—"}</td>
                <td className="p-2">
                  {lead.phone ? (
                    <a
                      className="underline"
                      href={waLink(lead.patient_name || "", lead.phone)}
                      target="_blank"
                    >
                      {normalizePhone(lead.phone)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">{lead.status || "new"}</td>
                <td className="p-2">{lead.note || "—"}</td>
                <td className="p-2">
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => openHistory(lead.id)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[500px] max-w-full p-6">
            <h2 className="text-lg font-semibold mb-4">Lead Details</h2>
            <p><b>Patient:</b> {modalLead.patient_name || "—"}</p>
            <p><b>Phone:</b> {modalLead.phone || "—"}</p>
            <p><b>Status:</b> {modalLead.status || "—"}</p>
            <p><b>Created:</b> {new Date(modalLead.created_at).toLocaleString()}</p>
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
              <button
                className="px-3 py-1 rounded border"
                onClick={() => setModalLead(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
