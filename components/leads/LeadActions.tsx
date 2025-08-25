"use client";

// @ts-nocheck
import * as React from "react";

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  note?: string | null;
  created_at?: string;
  status?: string | null;
};

type ProviderLite = {
  id: string;
  slug: string;
  display_name?: string | null;
};

function sanitizePhone(raw?: string | null) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // If 10 digits, assume Indian mobile and prefix 91
  if (digits.length === 10) return "91" + digits;
  // If already starts with country code (e.g. 91...), keep as-is
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

async function sendEvent(name: "wa.reminder.sent" | "wa.rebook.sent", payload: any) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload }),
    });
  } catch {
    // best-effort, ignore
  }
}

export default function LeadActions({
  lead,
  provider,
}: {
  lead: Lead;
  provider: ProviderLite;
}) {
  const providerName = provider.display_name || provider.slug;
  const envTest = (process.env.NEXT_PUBLIC_WA_TEST_NUMBER || "").trim();

  // ✅ Correct priority: test override (if explicitly set) → lead.phone → (no fallback)
  const targetNumber =
    envTest || sanitizePhone(lead.phone) || "";

  const disabled = !targetNumber;

  const onSend = async (kind: "reminder" | "rebook") => {
    const message =
      kind === "reminder"
        ? buildReminderMessage(providerName, lead)
        : buildRebookMessage(providerName, lead);

    // Copy text so desktop users can paste if WhatsApp Web doesn't auto-open
    await copy(message);

    if (!disabled) {
      const url =
        "https://wa.me/" +
        targetNumber +
        "?text=" +
        encodeURIComponent(message);

      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      // No phone present — just inform the user we copied the message
      alert("This lead has no phone number. The message has been copied to your clipboard.");
    }

    // Telemetry (best-effort)
    await sendEvent(
      kind === "reminder" ? "wa.reminder.sent" : "wa.rebook.sent",
      {
        lead_id: lead.id,
        provider_slug: provider.slug,
        to: disabled ? null : targetNumber,
        has_phone: Boolean(lead.phone),
      }
    );
  };

  const btnBase =
    "px-3 py-1.5 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex gap-2">
      <button
        className={btnBase}
        onClick={() => onSend("reminder")}
        disabled={disabled}
        title={disabled ? "No phone number on this lead" : "Send WhatsApp reminder"}
        type="button"
      >
        Send WA Reminder
      </button>
      <button
        className={btnBase}
        onClick={() => onSend("rebook")}
        disabled={disabled}
        title={disabled ? "No phone number on this lead" : "Send WhatsApp rebooking ping"}
        type="button"
      >
        Send Rebooking Ping
      </button>
    </div>
  );
}
