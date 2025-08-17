// app/dashboard/leads/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Lead = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  status: "new" | "contacted" | "closed" | string | null;
  source: string | null;
  created_at: string;
  note: string | null;
  owner_id?: string | null;
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

  // Fetch leads owned by the current user (RLS-enforced)
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
        console.error("Error loading leads:", error.message);
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
    // Uses secured API to read one lead (proves auth + RLS ok)
    const res = await fetch(`/api/leads/history?id=${id}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to load history");
      return;
    }
    // You can enhance this to show a modal; for now just alert key fields
    const lead = json.lead as Lead;
    alert(
      `Lead: ${lead.patient_name || "N/A"}\nPhone: ${lead.phone || "N/A"}\nStatus: ${
        lead.status || "N/A"
      }\nNote: ${lead.note || ""}\nCreated: ${new Date(lead.created_at).toLocaleString()}`
    );
  }

  function onEditNote(lead: Lead) {
    setEditingId(lead.id);
    setDraftNote(lead.note || "");
  }

  function onCancelEdit() {
    setEditingId(null);
    setDraftNote("");
  }

  async function onSaveNote(lead: Lead) {
    setSavingId(lead.id);
    try {
      const res = await fetch("/api/leads/update-note", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: lead.id, note: draftNote }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("Save note failed:", json);
        alert(json?.error || "Failed to save note");
        return;
      }
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, note: json.note ?? draftNote } : l))
      );
      setEditingId(null);
      setDraftNote("");
    } finally {
      setSavingId(null);
    }
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
                    <td className="p-3 align-top capitalize">{lead.status || "new"}</td>
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
                              onClick={() => onSaveNote(lead)}
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
                          {lead.note ? lead.note : <span className="text-gray-500">—</span>}
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
    </div>
  );
}
