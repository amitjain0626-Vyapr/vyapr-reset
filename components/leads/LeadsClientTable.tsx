// components/leads/LeadsClientTable.tsx
// @ts-nocheck
"use client";

import * as React from "react";
import { useMemo, useState, useCallback, useEffect } from "react";
import LeadActions from "@/components/leads/LeadActions";
import { toast } from "sonner";
import LeadTimeline from "@/components/leads/LeadTimeline";
import ToasterMount from "@/components/ui/ToasterMount";
import { waReminder, waRebook } from "@/lib/wa/templates";
import RoiBar from "@/components/leads/RoiBar";

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Provider = {
  id: string;
  slug: string;
  display_name?: string | null;
};

function safeArray<T = any>(xs: any): T[] {
  if (!Array.isArray(xs)) return [];
  return xs.filter(Boolean);
}

const STATUS_VALUES = ["new", "active", "closed"] as const;

/* === tracked Collect link builder === */
function buildTrackedCollectUrl(provider: Provider, lead: Lead, text: string) {
  const phone = (lead.phone || "").replace(/[^\d]/g, "");
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  const p = new URLSearchParams();
  p.set("provider_id", provider.id);
  p.set("lead_id", lead.id);
  p.set("phone", phone);
  p.set("text", text);
  p.set("ref", ref);
  return `/api/track/wa-collect?${p.toString()}`;
}

/* templates (confirm/rebook) */
function buildReminderText(lead: Lead, provider: Provider, campaign?: string) {
  const name = (lead.patient_name || "").trim();
  const prov = (provider.display_name || provider.slug || "your provider").trim();
  return waReminder({ name, provider: prov, slug: provider.slug, leadId: lead.id, campaign });
}
function buildRebookText(lead: Lead, provider: Provider, campaign?: string) {
  const name = (lead.patient_name || "").trim();
  const prov = (provider.display_name || provider.slug || "your provider").trim();
  return waRebook({ name, provider: prov, slug: provider.slug, leadId: lead.id, campaign });
}

/* === Collect (payment) text — supports amount === */
function buildCollectText(lead: Lead, provider: Provider, amount?: number) {
  const name = (lead.patient_name || "").trim();
  const prov = (provider.display_name || provider.slug || "your provider").trim();
  const hi = name ? `Hi ${name},` : "Hi!";
  let payUrl = `https://vyapr-reset-5rly.vercel.app/pay/${encodeURIComponent(
    lead.id
  )}?slug=${encodeURIComponent(provider.slug)}`;
  const am = Number(amount);
  if (am > 0 && Number.isFinite(am)) payUrl += `&am=${Math.round(am)}`;
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  return [
    hi,
    `This is a friendly reminder to complete your pending payment with ${prov}.`,
    `You can pay here: ${payUrl}`,
    `Ref: ${ref}`,
  ].join("\n");
}

const encode = (s: string) => encodeURIComponent(s);

/* utils */
function inr(n?: number) {
  return typeof n === "number" ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "0";
}
function timeAgo(ts?: number) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/* ---------- Status → colored chip (supports verified/booked/paid) ---------- */
function StatusChip({ value }: { value?: string | null }) {
  const v = String(value || "new").toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-blue-50 border-blue-300 text-blue-900" },
    verified: { label: "Verified", cls: "bg-emerald-50 border-emerald-300 text-emerald-900" },
    booked: { label: "Booked", cls: "bg-amber-50 border-amber-300 text-amber-900" },
    paid: { label: "Paid", cls: "bg-violet-50 border-violet-300 text-violet-900" },
    active: { label: "Active", cls: "bg-amber-50 border-amber-300 text-amber-900" },
    closed: { label: "Closed", cls: "bg-gray-100 border-gray-300 text-gray-700" },
  };
  const { label, cls } = map[v] || map["new"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ---------- Calendar URL helper ---------- */
function buildCalendarUrl(provider: Provider, lead: Lead) {
  const params = new URLSearchParams();
  params.set("slug", provider.slug);
  params.set("title", `Booking • ${lead.patient_name || "Customer"}`);
  params.set("lead_id", lead.id);
  params.set("startISO", new Date(Date.now() + 60 * 60 * 1000).toISOString()); // +1h
  params.set("endISO", new Date(Date.now() + 90 * 60 * 1000).toISOString());   // +1.5h
  return `/api/google-calendar/sync?${params.toString()}`;
}

export default function LeadsClientTable({
  rows: rowsProp,
  provider,
}: {
  rows: Lead[];
  provider: Provider;
}) {
  const rows = safeArray<Lead>(rowsProp);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const selectedLeads = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  // Persisted bulk campaign
  const [bulkCampaign, setBulkCampaign] = useState<
    "direct" | "whatsapp" | "sms" | "instagram" | "qr" | "confirm" | "noshow" | "reactivation"
  >("direct");

  // Status editor (optimistic)
  const [statusLocal, setStatusLocal] = useState<Record<string, (typeof STATUS_VALUES)[number]>>({});
  const updateLeadStatus = useCallback(
    async (leadId: string, to: (typeof STATUS_VALUES)[number]) => {
      try {
        setStatusLocal((m) => ({ ...m, [leadId]: to }));
        const res = await fetch("/api/leads/update-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: leadId, status: to, provider_slug: provider.slug }),
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
    [provider.slug]
  );

  // Quick chip: Mark verified via /api/leads/update-status (no schema drift)
  const setStatusVerified = useCallback(
    async (leadId: string) => {
      try {
        setStatusLocal((m) => ({ ...m, [leadId]: "verified" }));
        const res = await fetch("/api/leads/update-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: leadId, status: "verified", provider_slug: provider.slug }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Update failed");
        toast.success("Marked as verified");
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
    [provider.slug]
  );

  // Timeline drawer state
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Per-lead amount state (MVP, client-only)
  const [amountMap, setAmountMap] = useState<Record<string, number>>({});
  const setAmt = useCallback((id: string, v?: number) => {
    setAmountMap((m) => {
      const n = { ...m };
      const num = Math.round(Number(v || 0));
      if (num > 0) n[id] = num;
      else delete n[id];
      return n;
    });
  }, []);

  // Bulk WA actions
  const openMany = useCallback((hrefs: string[]) => {
    hrefs.forEach((h, i) => {
      setTimeout(() => window.open(h, "_blank", "noopener,noreferrer"), i * 120);
    });
  }, []);
  const copyMany = useCallback(async (texts: string[]) => {
    try {
      await navigator.clipboard.writeText(texts.join("\n\n"));
      toast.success("Copied");
    } catch {
      toast.message("Copy failed");
    }
  }, []);
  const doBulk = useCallback(
    async (kind: "reminder" | "rebook", action: "open" | "copy") => {
      if (!selectedLeads.length) {
        toast.message("Select at least 1 lead");
        return;
      }
      const texts = selectedLeads.map((r) =>
        kind === "reminder" ? buildReminderText(r, provider, bulkCampaign) : buildRebookText(r, provider, bulkCampaign)
      );
      if (action === "copy") {
        copyMany(texts);
        return;
      }
      const hrefs = selectedLeads.map((r, idx) => {
        const s = (r.phone || "").replace(/[^\d]/g, "");
        const text = texts[idx];
        return `https://api.whatsapp.com/send/?phone=${s}&text=${encode(text)}&type=phone_number&app_absent=0`;
      });
      openMany(hrefs);

      try {
        await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: kind === "reminder" ? "wa.reminder.bulk" : "wa.rebook.bulk",
            provider_id: provider.id,
            lead_ids: selectedLeads.map((r) => r.id),
            ts: Date.now(),
            source: { via: "ui", bulk: true, to: "multiple", campaign: bulkCampaign },
          }),
        });
      } catch {}
    },
    [provider, selectedLeads, bulkCampaign, copyMany, openMany]
  );

  // Load paid map for visible leads
  const [paidMap, setPaidMap] = useState<Record<string, { amount: number; ts: number }>>({});
  useEffect(() => {
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    const url = `/api/leads/paid?provider_id=${encodeURIComponent(provider.id)}&leads=${encodeURIComponent(
      ids.join(",")
    )}`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok) setPaidMap(json.map || {});
      })
      .catch(() => {});
  }, [provider?.id, rows]);

  // per-lead mark paid
  async function markPaid(lead: Lead, provider: Provider) {
    const raw = prompt("Amount received (₹) — numbers only:");
    if (raw === null) return;
    const amount = Math.round(Number(String(raw).replace(/[^\d.]/g, "")));
    if (!amount || amount <= 0) {
      toast.message("Please enter a valid amount");
      return;
    }
    const method = (prompt("Method (upi/cash/other):", "upi") || "upi").toLowerCase();

    try {
      const res = await fetch("/api/payments/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: provider.id, lead_id: lead.id, amount, method }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not mark paid");
      toast.success("Marked as paid");
      setPaidMap((m) => ({ ...m, [lead.id]: { amount, ts: Date.now() } }));
      setHighlightIds((s) => new Set([...s, lead.id]));
      setTimeout(() => {
        setHighlightIds((s) => {
          const n = new Set(s);
          n.delete(lead.id);
          return n;
        });
      }, 1500);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  // --- NEW: small inline upsell hint when many leads selected (free → paid flows) ---
  const showInlineUpsell = selectedLeads.length >= 3;

  return (
    <div className="w-full">
      {/* NEW: inline upsell hint above toolbar */}
      {showInlineUpsell && (
        <div className="mb-3 rounded-xl border p-3 bg-indigo-50 text-indigo-900 text-xs flex items-center justify-between">
          <span>Reach more customers faster — unlock paid discovery & templates.</span>
          <div className="flex items-center gap-2">
            <a
              href={`/upsell?slug=${encodeURIComponent(provider.slug)}`}
              className="rounded-lg bg-indigo-600 px-2 py-1 text-white shadow hover:bg-indigo-700 transition text-xs"
            >
              🚀 Boost visibility
            </a>
            <a
              href={`/templates?slug=${encodeURIComponent(provider.slug)}`}
              className="rounded-lg border border-indigo-600 px-2 py-1 text-indigo-700 bg-white hover:bg-indigo-50 transition text-xs"
            >
              🧰 Template packs
            </a>
          </div>
        </div>
      )}

      {/* Bulk toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-500">Camp.</label>
        <select
          value={bulkCampaign}
          onChange={(e) => setBulkCampaign(e.target.value as any)}
          className="px-2 py-1 rounded border text-sm"
          title="Campaign for Bulk actions"
        >
          <option value="direct">Direct</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="instagram">Instagram</option>
          <option value="qr">QR</option>
          <option value="confirm">confirm</option>
          <option value="noshow">noshow</option>
          <option value="reactivation">reactivation</option>
        </select>

        <button className="px-2 py-1 rounded border" onClick={() => doBulk("reminder", "open")} disabled={selectedLeads.length === 0}>
          Bulk ▸ Open Reminders
        </button>
        <button className="px-2 py-1 rounded border" onClick={() => doBulk("rebook", "open")} disabled={selectedLeads.length === 0}>
          Bulk ▸ Open Rebooking
        </button>
        <button className="px-2 py-1 rounded border" onClick={() => doBulk("reminder", "copy")} disabled={selectedLeads.length === 0}>
          Bulk ▸ Copy Reminders
        </button>
        <button className="px-2 py-1 rounded border" onClick={() => doBulk("rebook", "copy")} disabled={selectedLeads.length === 0}>
          Bulk ▸ Copy Rebooking
        </button>
      </div>

      {/* ROI strip */}
      <RoiBar providerId={provider.id} />

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
              rows.map((r) => {
                const paidInfo = paidMap[r.id];
                const isPaid = !!paidInfo;
                const amt = amountMap[r.id] || undefined;
                const statusValue = statusLocal[r.id] || (r?.status as any) || "new";

                return (
                  <tr key={r.id} className={`border-t ${highlightIds.has(r.id) ? "bg-emerald-50" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="h-4 w-4" checked={selected.has(r.id)} onChange={() => toggle(r.id)} disabled={!r?.phone} />
                    </td>
                    <td className="px-3 py-2">{r?.patient_name || "-"}</td>
                    <td className="px-3 py-2">
                      {r?.phone ? (
                        <a href={`tel:${r.phone}`} className="text-blue-600 hover:underline">
                          {r.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* ---- COLORED STATUS CHIP ---- */}
                    <td className="px-3 py-2">
                      <StatusChip value={statusValue} />
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
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <button
                          className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                          onClick={() => {
                            setTimelineLeadId(r.id);
                            setTimelineOpen(true);
                          }}
                        >
                          🕒 Timeline
                        </button>

                        {/* NEW: one-tap verified */}
                        <button
                          className="px-2 py-1 rounded border text-sm hover:bg-emerald-50 disabled:opacity-50"
                          onClick={() => setStatusVerified(r.id)}
                          title="Mark this lead as verified"
                          disabled={String(statusValue).toLowerCase() === "verified"}
                        >
                          {String(statusValue).toLowerCase() === "verified" ? "✓ Verified" : "✓ Mark verified"}
                        </button>

                        <label className="text-xs text-gray-500">Status</label>
                        <select
                          className="px-2 py-1 rounded border text-sm"
                          value={statusValue}
                          onChange={(e) => updateLeadStatus(r.id, e.target.value as (typeof STATUS_VALUES)[number])}
                        >
                          {STATUS_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Amount presets (hide when paid) */}
                      {!isPaid && (
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">Amount</span>
                          {[500, 1000, 2000].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setAmt(r.id, v)}
                              className={`px-2 py-0.5 rounded border text-xs ${
                                amt === v ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "hover:bg-gray-50"
                              }`}
                              data-test={`lead-amount-chip-${v}`}
                              title={`Set ₹${v.toLocaleString("en-IN")}`}
                            >
                              ₹{v.toLocaleString("en-IN")}
                            </button>
                          ))}
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Custom ₹"
                            value={amt ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, "");
                              setAmt(r.id, raw ? Number(raw) : 0);
                            }}
                            className="w-24 rounded border px-2 py-1 text-xs font-mono"
                            data-test="lead-amount-input"
                            title="Custom amount"
                          />
                        </div>
                      )}

                      {/* Collect + Mark Paid + Add to Calendar */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          className="px-2 py-1 rounded border text-sm hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={isPaid || !r?.phone}
                          onClick={() => {
                            if (!r?.phone) {
                              toast.message("No phone on this lead", { duration: 1200 });
                              return;
                            }
                            const text = buildCollectText(r, provider, amt);
                            const href = buildTrackedCollectUrl(provider, r, text);
                            window.open(href, "_blank", "noopener,noreferrer");
                          }}
                          title={isPaid ? "Already paid — Collect disabled" : "Send payment reminder on WhatsApp"}
                          data-test="lead-collect-cta"
                        >
                          💬 Collect
                        </button>

                        <button
                          className="px-2 py-1 rounded border text-sm hover:bg-emerald-50"
                          onClick={() => markPaid(r, provider)}
                          title="Record a payment received"
                          data-test="lead-mark-paid"
                        >
                          ✓ Mark paid
                        </button>

                        {/* NEW: Add to Calendar */}
                        <button
                          className="px-2 py-1 rounded border text-sm hover:bg-blue-50"
                          onClick={() => {
                            const url = buildCalendarUrl(provider, r);
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          title="Create a calendar event for this lead"
                          data-test="lead-add-to-calendar"
                        >
                          📅 Add to Calendar
                        </button>
                      </div>

                      {/* Per-row actions */}
                      <div className="mt-2 flex items-center gap-2">
                        <LeadActions className="flex items-center gap-2" lead={r} provider={provider} />
                      </div>
                    </td>
                  </tr>
                );
              })
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

      <LeadTimeline open={timelineOpen} onClose={() => setTimelineOpen(false)} leadId={timelineLeadId} />
      <ToasterMount />
    </div>
  );
}
