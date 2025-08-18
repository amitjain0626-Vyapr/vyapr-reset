// app/dashboard/leads/page.tsx
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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<"all" | "new" | "contacted" | "closed">("all");

  // inline edit (table)
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string>("");

  // modal state
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const closeModal = useCallback(() => setModalLead(null), []);

  // 🔧 One-time SW/caches clear if ?refresh=1
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("refresh") === "1") {
      (async () => {
        try {
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if ("caches" in window) {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
          }
        } finally {
          url.searchParams.delete("refresh");
          window.location.replace(url.toString());
        }
      })();
    }
  }, []);

  // Fetch leads owned by current user (RLS enforced)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("Leads")
        .select("id, patient_name, phone, status, source, created_at, note")
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        console.error("Error loading leads:", error.message);
        setLeads([]);
      } else {
        setLeads(data || []);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter(
      (l) => (l.status || "new").toLowerCase() === filter
    );
  }, [leads, filter]);

  async function openHistory(id: string) {
    const res = await fetch(`/api/leads/history?id=${id}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Failed to load history:", json);
      return;
    }
    setModalLead(json.lead as Lead);
  }

  function onEditNote(lead: Lead) {
    setEditingId(lead.id);
    setDraftNote(lead.note || "");
  }
  function onCancelEdit() {
    setEditingId(null);
    setDraftNote("");
  }

  async function onSaveNoteInline(lead: Lead) {
    if (!editingId) return;
    await onSaveNote(lead, draftNote);
    setEditingId(null);
    setDraftNote("");
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
      if (!res.ok) {
        console.error("Failed to save note:", json);
        return;
      }
      // update table
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, note: json.note } : l))
      );
      // update modal (if same lead open)
      if (modalLead?.id === lead.id) {
        setModalLead({ ...modalLead, note: json.note });
      }
    } finally {
      setSavingId(null);
    }
  }

  // esc to close modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    if (modalLead) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [modalLead, closeModal]);

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
              {visible.map((lead) => {
                const phone = normalizePhone(lead.phone || "");
                const when = new Date(lead.created_at).toLocaleString();
                const isEditing = editingId === lead.id;
                const isSaving = savingId === lead.id;

                return (
                  <tr key={lead.id} className="border-t">
                    <td className="p-3 align-top whitespace-nowrap">{when}</td>
                    <td className="p-3 align-top">{lead.patient_name || "—"}</td>
                    <td className="p-3 align-top">
                      {phone ? (
                        <a
                          className="underline"
                          href={waLink(lead.patient_name || "", phone)}
                          target="_blank"
                          rel="noreferrer"
                          title="Chat on WhatsApp"
                        >
                          {phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 align-top capitalize">
                      {lead.status || "new"}
                    </td>
                    <td className="p-3 align-top w-[360px]">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            className="w-full min-h-[80px] p-2 border rounded"
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            maxLength={5000}
                            placeholder="Add a note…"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => onSaveNoteInline(lead)}
                              disabled={isSaving}
                              className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                            >
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={onCancelEdit}
                              disabled={isSaving}
                              className="px-3 py-1 rounded border"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-gray-900">
                          {lead.note ? lead.note : (
                            <span className="text-gray-500">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      {!isEditing ? (
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 rounded border"
                            onClick={() => onEditNote(lead)}
                          >
                            Edit note
                          </button>
                          <button
                            className="px-3 py-1 rounded border"
                            onClick={() => openHistory(lead.id)}
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Editing…</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalLead && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal(); // click outside to close
          }}
        >
          <div className="bg-white rounded-xl shadow-lg w-[560px] max-w-[94vw] p-6">
            <h2 className="text-lg font-semibold mb-4">Lead Details</h2>

            <div className="space-y-1 text-sm">
              <p><b>Patient:</b> {modalLead.patient_name || "—"}</p>
              <p><b>Phone:</b> {modalLead.phone || "—"}</p>
              <p><b>Status:</b> {modalLead.status || "—"}</p>
              <p>
                <b>Created:</b>{" "}
                {new Date(modalLead.created_at).toLocaleString()}
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Tip: Click outside or press Esc to close.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <a
                className="px-3 py-1 rounded border"
                href={modalLead.phone ? waLink(modalLead.patient_name || "", modalLead.phone) : "#"}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <button className="px-3 py-1 rounded border" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
