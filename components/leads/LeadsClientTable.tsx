"use client";
// @ts-nocheck
import * as React from "react";
import LeadActions from "@/components/leads/LeadActions";

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  note?: string | null;
  status?: string | null;
  created_at?: string;
};

type ProviderLite = {
  id: string;
  slug: string;
  display_name?: string | null;
};

function sanitizePhone(raw?: string | null) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  return digits;
}

function istDateTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function buildReminderMessage(providerName: string, lead: Lead) {
  const when = istDateTime(lead.created_at);
  const who = lead.patient_name?.trim() || "there";
  return (
    `Hi ${who}, this is ${providerName}.\n` +
    `Reminder for your appointment/enquiry — ${when} (IST).\n` +
    (lead.note ? `Note: ${lead.note}\n` : "") +
    `Reply here and I’ll confirm your slot.`
  );
}

function buildRebookMessage(providerName: string, lead: Lead) {
  const who = lead.patient_name?.trim() || "there";
  return (
    `Hi ${who}, this is ${providerName}.\n` +
    `Hope you’re doing well. Would you like to book a fresh slot this week?\n` +
    `Reply YES and I’ll share available times.`
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function sendEvent(name: string, payload: any) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload }),
    });
  } catch {}
}

export default function LeadsClientTable({
  leads,
  provider,
}: {
  leads: Lead[];
  provider: ProviderLite;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allSelected = selected.size === leads.length && leads.length > 0;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const providerName = provider.display_name || provider.slug;
  const envTest = (process.env.NEXT_PUBLIC_WA_TEST_NUMBER || "").trim();

  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const withPhones = selectedLeads.filter((l) => envTest || sanitizePhone(l.phone));
  const withoutPhones = selectedLeads.length - withPhones.length;

  async function doBulk(kind: "reminder" | "rebook", mode: "copy" | "open") {
    if (selectedLeads.length === 0) return;

    // Build all messages
    const entries = selectedLeads.map((l) => {
      const msg = kind === "reminder" ? buildReminderMessage(providerName, l) : buildRebookMessage(providerName, l);
      const number = envTest || sanitizePhone(l.phone) || "";
      return { lead: l, msg, number };
    });

    if (mode === "copy") {
      const bundle = entries
        .map((e, i) => {
          const head = `#${i + 1} — ${e.lead.patient_name || "Unknown"} ${e.number ? `(+${e.number})` : "(no phone)"}`;
          return head + "\n" + e.msg;
        })
        .join("\n\n-------------------------\n\n");
      await copy(bundle);
      alert(`Copied ${entries.length} messages${withoutPhones ? ` (${withoutPhones} without phone)` : ""}.`);
    } else {
      // Open chats for those with phone numbers; limit to 6 to avoid popup blockers
      const toOpen = entries.filter((e) => e.number).slice(0, 6);
      toOpen.forEach((e) => {
        const url = "https://wa.me/" + e.number + "?text=" + encodeURIComponent(e.msg);
        window.open(url, "_blank", "noopener,noreferrer");
      });
      if (entries.filter((e) => e.number).length > 6) {
        alert("Opened first 6 chats (browser popup limit). Use Copy for larger batches.");
      } else if (toOpen.length === 0) {
        alert("No valid phone numbers to open. Use Copy instead.");
      }
    }

    // Telemetry (best-effort)
    await sendEvent(`wa.bulk.${kind}.${mode}`, {
      provider_slug: provider.slug,
      selected: selectedLeads.map((l) => l.id),
      withPhones: withPhones.map((l) => l.id),
      withoutPhones,
      count: selectedLeads.length,
    });

    // Also mark each single send for parity
    await Promise.all(
      withPhones.map((l) =>
        sendEvent(kind === "reminder" ? "wa.reminder.sent" : "wa.rebook.sent", {
          lead_id: l.id,
          provider_slug: provider.slug,
          to: envTest || sanitizePhone(l.phone),
          bulk: true,
        })
      )
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk bar */}
      {selectedLeads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 border rounded bg-gray-50">
          <span className="text-sm">
            Selected: <b>{selectedLeads.length}</b>{" "}
            {withoutPhones ? <span className="opacity-70">({withoutPhones} without phone)</span> : null}
          </span>
          <button
            type="button"
            className="px-3 py-1.5 border rounded text-sm"
            onClick={() => doBulk("reminder", "open")}
            title="Open WhatsApp chats for selected (up to 6)"
          >
            Open WA Reminders
          </button>
          <button
            type="button"
            className="px-3 py-1.5 border rounded text-sm"
            onClick={() => doBulk("reminder", "copy")}
            title="Copy all reminder messages"
          >
            Copy Reminders
          </button>
          <span className="mx-1 opacity-40">|</span>
          <button
            type="button"
            className="px-3 py-1.5 border rounded text-sm"
            onClick={() => doBulk("rebook", "open")}
            title="Open WhatsApp chats for selected (up to 6)"
          >
            Open WA Rebooking
          </button>
          <button
            type="button"
            className="px-3 py-1.5 border rounded text-sm"
            onClick={() => doBulk("rebook", "copy")}
            title="Copy all rebooking messages"
          >
            Copy Rebooking
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">
                <input
                  aria-label="Select all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left">Lead</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">
                  <input
                    aria-label={`Select ${l.patient_name || l.id}`}
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggleOne(l.id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{l.patient_name || "Unknown"}</div>
                  {l.note ? <div className="text-xs opacity-70">{l.note}</div> : null}
                </td>
                <td className="px-3 py-2">{l.phone || "-"}</td>
                <td className="px-3 py-2">{l.status || "new"}</td>
                <td className="px-3 py-2">
                  {new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }).format(new Date(l.created_at!))}
                </td>
                <td className="px-3 py-2">
                  <LeadActions
                    lead={l}
                    provider={provider}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
