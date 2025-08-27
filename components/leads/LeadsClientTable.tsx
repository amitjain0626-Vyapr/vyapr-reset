// components/leads/LeadsClientTable.tsx
// @ts-nocheck
"use client";

import * as React from "react";
import { useMemo, useState, useCallback } from "react";
import LeadActions from "@/components/leads/LeadActions";
import { toast } from "sonner";
import LeadTimeline from "@/components/leads/LeadTimeline";
import ToasterMount from "@/components/ui/ToasterMount";
import { waReminder, waRebook } from "@/lib/wa/templates";

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  note?: string | null;
  status?: "new" | "active" | "closed" | string | null;
  created_at?: string | null;
};

type Provider = {
  id: string;
  slug: string;
  display_name?: string | null;
};

function safeArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

async function fireEvent(payload: {
  event: string;
  provider_id?: string | null;
  lead_id?: string | null;
  source?: any;
  ts?: number;
}) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ts: Date.now(), ...payload }),
    });
  } catch (e) {
    console.warn("events/log failed", e);
  }
}

function buildReminderText(lead: Lead, provider: Provider) {
  const name = (lead.patient_name || "").trim();
  const prov = (provider.display_name || provider.slug || "your provider").trim();
  return waReminder({ name, provider: prov, slug: provider.slug, leadId: lead.id });
}

function buildRebookText(lead: Lead, provider: Provider) {
  const name = (lead.patient_name || "").trim();
  const prov = (provider.display_name || provider.slug || "your provider").trim();
  return waRebook({ name, provider: prov, slug: provider.slug, leadId: lead.id });
}

const encode = (s: string) => encodeURIComponent(s);
const STATUS_VALUES = ["new", "active", "closed"] as const;

export default function LeadsClientTable({
  rows: rowsProp,
  provider,
}: {
  rows: Lead[];
  provider: Provider;
}) {
  const rows = safeArray(rowsProp);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectedLeads = useMemo(
    () => rows.filter((r) => r?.phone && selected.has(r.id)),
    [rows, selected]
  );

  // Status change state + API call
  const [statusLocal, setStatusLocal] = useState<Record<string, string>>({});
  const updateLeadStatus = useCallback(
    async (leadId: string, to: (typeof STATUS_VALUES)[number]) => {
      try {
        const res = await fetch("/api/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, to }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Update failed");
        setStatusLocal((m) => ({ ...m, [leadId]: to }));
        toast.success(`Status updated → ${to}`);
        setHighlightIds((s) => new Set([...s, leadId]));
        setTimeout(() => {
          setHighlightIds((s) => {
            const n = new Set(s);
            n.delete(leadId);
            return n;
          });
        }, 1500);
      } catch (e: any) {
        toast.error(e?.message || "Could not update status");
      }
    },
    []
  );

  // Timeline drawer state
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Bulk WA actions
  const doBulk = useCallback(
    async (kind: "reminder" | "rebook", action: "open" | "copy") => {
      if (selectedLeads.length === 0) {
        toast.message("No leads selected", { duration: 1400 });
        return;
      }
      const batch = selectedLeads.slice(0, 6);
      let opened = 0,
        copied = 0;
      for (const lead of batch) {
        const text =
          kind === "reminder"
            ? buildReminderText(lead, provider)
            : buildRebookText(lead, provider);
        const phone = (lead.phone || "").replace(/^\+/, "");
        const href = `https://wa.me/${encodeURIComponent(phone)}?text=${encode(text)}`;
        if (action === "open") {
          try {
            window.open(href, "_blank", "noopener,noreferrer");
            opened++;
          } catch {}
        } else {
          try {
            await navigator.clipboard.writeText(text);
            copied++;
          } catch {}
        }
        fireEvent({
          event: kind === "reminder" ? "wa.reminder.sent" : "wa.rebook.sent",
          lead_id: lead.id,
          source: { via: "ui", bulk: true, to: phone },
        });
      }
      if (action === "open") toast.success(`Opened ${opened} ${kind} messages`);
      else toast.success(`Copied ${copied} ${kind} messages`);
    },
    [provider, selectedLeads]
  );

  return (
    <div className="w-full">
      {/* Bulk toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <button
          className="px-2 py-1 rounded border"
          onClick={() => doBulk("reminder", "open")}
          disabled={selectedLeads.length === 0}
        >
          Bulk ▸ Open Reminders
        </button>
        <button
          className="px-2 py-1 rounded border"
          onClick={() => doBulk("rebook", "open")}
          disabled={selectedLeads.length === 0}
        >
          Bulk ▸ Open Rebooking
        </button>
        <button
          className="px-2 py-1 rounded border"
          onClick={() => doBulk("reminder", "copy")}
          disabled={selectedLeads.length === 0}
        >
          Bulk ▸ Copy Reminders
        </button>
        <button
          className="px-2 py-1 rounded border"
          onClick={() => doBulk("rebook", "copy")}
          disabled={selectedLeads.length === 0}
        >
          Bulk ▸ Copy Rebooking
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Select</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Created (IST)</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t transition-colors ${
                    highlightIds.has(r.id) ? "bg-emerald-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      disabled={!r?.phone}
                    />
                  </td>
                  <td className="px-3 py-2">{r?.patient_name || "-"}</td>
                  <td className="px-3 py-2">{r?.phone || "-"}</td>
                  {/* Status (read-only display) */}
                  <td className="px-3 py-2">
                    {statusLocal[r.id] || r?.status || "new"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r?.created_at
                      ? new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(r.created_at))
                      : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {/* Timeline + Status dropdown */}
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                        onClick={() => {
                          setTimelineLeadId(r.id);
                          setTimelineOpen(true);
                        }}
                        title="Timeline"
                      >
                        🕒 Timeline
                      </button>
                      <label className="text-xs text-gray-500">Status</label>
                      <select
                        className="px-2 py-1 rounded border text-sm"
                        value={statusLocal[r.id] || r?.status || "new"}
                        onChange={(e) =>
                          updateLeadStatus(
                            r.id,
                            e.target.value as (typeof STATUS_VALUES)[number]
                          )
                        }
                      >
                        {STATUS_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Existing notes/WA actions component */}
                    <LeadActions
                      className="flex items-center gap-2"
                      lead={r}
                      provider={provider}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-gray-500" colSpan={6}>
                  No leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lead Timeline drawer */}
      <LeadTimeline
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        leadId={timelineLeadId}
      />
      <ToasterMount />
    </div>
  );
}
