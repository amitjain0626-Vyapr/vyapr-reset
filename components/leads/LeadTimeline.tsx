// components/leads/LeadTimeline.tsx
// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type TimelineEvent = {
  id: string;
  event: string;
  ts: number;
  provider_id: string;
  lead_id: string | null;
  source: any;
};

export default function LeadTimeline({
  open,
  onClose,
  leadId,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // search/filter
  const [q, setQ] = useState("");

  // provider notes state
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = (noteText ?? "").trim().length > 0 && !!leadId && !saving;

  // customer notes state (simulator)
  const [custText, setCustText] = useState("");
  const [custSaving, setCustSaving] = useState(false);
  const custCanSave =
    (custText ?? "").trim().length > 0 && !!leadId && !custSaving;

    // quick type filter
const [type, setType] = useState<"all" | "notes" | "wa" | "nudges">("all");

  // fetch events
  async function loadEvents() {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/debug/events?lead_id=${encodeURIComponent(
        leadId
      )}&limit=50`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load events");
      }
      const sorted = [...(json.rows || [])].sort(
        (a, b) => Number(b.ts || 0) - Number(a.ts || 0)
      );
      setRows(sorted);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && leadId) loadEvents();
  }, [open, leadId]);

  // provider note submit
  async function onAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !leadId) return;
    try {
      setSaving(true);
      const res = await fetch("/api/leads/add-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, text: noteText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add note");

      setNoteText("");
      toast.success("Provider note added");
      await loadEvents();
    } catch (err: any) {
      setError(err?.message || "Failed to add note");
      toast.error("Failed to add provider note");
    } finally {
      setSaving(false);
    }
  }

  // customer note submit
  async function onAddCustNote(e: React.FormEvent) {
    e.preventDefault();
    if (!custCanSave || !leadId) return;
    try {
      setCustSaving(true);
      const res = await fetch("/api/leads/add-customer-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, text: custText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "Failed to add customer note");

      setCustText("");
      toast.success("Customer note added");
      await loadEvents();
    } catch (err: any) {
      setError(err?.message || "Failed to add customer note");
      toast.error("Failed to add customer note");
    } finally {
      setCustSaving(false);
    }
  }

  const filtered = rows.filter((ev) => {
  // type filter first
  const e = (ev.event || "");
  const typePass =
    type === "all"
      ? true
      : type === "notes"
      ? e.startsWith("note.")
      : type === "wa"
      ? e.startsWith("wa.")
      : e.startsWith("nudge."); // nudges

  if (!typePass) return false;

  // optional search
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  const hay1 = e.toLowerCase();
  const hay2 = JSON.stringify(ev.source || {}).toLowerCase();
  return hay1.includes(needle) || hay2.includes(needle);
});

  return (
    <div
      className={`fixed inset-0 z-[60] ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-colors ${
          open ? "bg-black/40" : "bg-transparent"
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold">
            Lead Timeline{leadId ? ` — ${leadId.slice(0, 6)}…` : ""}
          </h3>
          <div className="flex items-center gap-2">
            {leadId && (
              <a
                href={`/api/leads/export-timeline?lead_id=${leadId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-2 py-1 text-sm hover:bg-gray-100"
              >
                Download CSV
              </a>
            )}
            <button
              className="rounded px-2 py-1 text-sm hover:bg-gray-100"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-56px)] overflow-y-auto p-4 space-y-4">
          {/* Provider note form */}
          <form
            onSubmit={onAddNote}
            className="rounded-lg border p-3 bg-white shadow-sm"
          >
            <label className="block text-sm font-medium mb-2">
              Add a provider note
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded border p-2 text-sm"
              placeholder="What happened on this lead?"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {Math.min((noteText ?? "").length, 500)} / 500
              </span>
              <button
                type="submit"
                disabled={!canSave}
                className={`px-3 py-1.5 rounded text-sm border ${
                  canSave ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving…" : "Add note"}
              </button>
            </div>
          </form>

          {/* Customer note form (simulator for now) */}
          <form
            onSubmit={onAddCustNote}
            className="rounded-lg border p-3 bg-white shadow-sm"
          >
            <label className="block text-sm font-medium mb-2">
              Simulate customer note
            </label>
            <textarea
              value={custText}
              onChange={(e) => setCustText(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded border p-2 text-sm"
              placeholder="E.g. 'Sorry, will come tomorrow'"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {Math.min((custText ?? "").length, 500)} / 500
              </span>
              <button
                type="submit"
                disabled={!custCanSave}
                className={`px-3 py-1.5 rounded text-sm border ${
                  custCanSave
                    ? "hover:bg-gray-50"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                {custSaving ? "Saving…" : "Add customer note"}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600">Error: {error}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">
              No events yet for this lead.
            </div>
          ) : (
            <>
              {/* quick type chips */}
    <div className="mb-2 flex items-center gap-2">
      {[
        { k: "all",    label: "All" },
        { k: "notes",  label: "Notes" },
        { k: "wa",     label: "WhatsApp" },
        { k: "nudges", label: "Nudges" },
      ].map(({ k, label }) => (
        <button
          key={k}
          type="button"
          onClick={() => setType(k as any)}
          className={`rounded border px-2 py-1 text-xs ${
            type === (k as any) ? "bg-gray-100 border-gray-400" : "hover:bg-gray-50"
          }`}
          title={label}
        >
          {label}
        </button>
      ))}
    </div>

    {/* tiny search */}
    <div className="mb-2 flex items-center gap-2">
      <input
        value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-sm"
                  placeholder="Filter timeline (try: wa., note., lead., or any word from details)"
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    title="Clear"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* filtered list */}
              <ul className="space-y-3">
                {filtered.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg border p-3 shadow-sm bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ev.event}</span>
                      <time className="text-xs text-gray-500">
                        {new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(Number(ev.ts)))}
                      </time>
                    </div>
                    {ev?.source ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                        {JSON.stringify(ev.source, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
