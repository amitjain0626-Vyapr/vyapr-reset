// @ts-nocheck
"use client";

import * as React from "react";

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  note?: string | null;
  provider_id?: string | null;
  provider_slug?: string | null; // present in some views
  appointment_at?: string | null; // if you have it; we only use it when present
  created_at?: string | null; // safe fallback for context (not shown as slot)
};

type ProviderMini = {
  id?: string | null;
  display_name?: string | null;
  slug?: string | null;
};

type Props = {
  lead: Lead;
  provider: ProviderMini; // pass { display_name, slug, id } from the page
  baseUrl?: string; // optional override; defaults to NEXT_PUBLIC_BASE_URL || location.origin
};

export default function LeadActions({ lead, provider, baseUrl }: Props) {
  const [copied, setCopied] = React.useState<null | "reminder" | "rebook">(null);

  // --- Config/Env overrides ---
  const TEST_WA = process.env.NEXT_PUBLIC_WA_TEST_NUMBER || "9773515300"; // temp per your instruction
  const BASE = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "https://vyapr-reset-5rly.vercel.app");

  // If test override is set, we always send to this number; else use lead.phone
  const targetPhone = TEST_WA?.trim() || lead.phone || "";

  const providerName = provider?.display_name || "your provider";
  const providerSlug = lead?.provider_slug || provider?.slug || "";
  const bookingLink = providerSlug ? `${BASE}/book/${providerSlug}` : `${BASE}`;

  const disabledBecauseNoPhone = !targetPhone;

  // --- Helpers ---
  const isMobile = () => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  };

  const toE164ish = (raw: string) => {
    // Keep digits; default to +91 if it looks like Indian local
    const digits = (raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("91")) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
    return `+${digits}`; // last resort
  };

  const fmtIST = (iso: string) => {
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(dt);
    } catch {
      return "";
    }
  };

  const maybeSlot = () => {
    if (lead?.appointment_at) return ` on ${fmtIST(lead.appointment_at)} (IST)`;
    return ""; // do not guess; only include if present
  };

  const tplReminder = () => {
    const name = lead?.patient_name?.trim() || "there";
    const slotStr = maybeSlot(); // empty when not available
    const note = lead?.note ? `\nNotes: ${lead.note}` : "";
    return `Hi ${name}, this is a reminder for your booking with ${providerName}${slotStr}. Reply YES to confirm.${note ? note : ""}`;
  };

  const tplRebook = () => {
    const name = lead?.patient_name?.trim() || "there";
    const note = lead?.note ? `\n(Ref: ${lead.note})` : "";
    const tail = providerSlug ? `\nBook here: ${bookingLink}` : "";
    return `Hi ${name}, we missed you last time. Would you like to pick a slot this week?${tail}${note}\n— ${providerName}`;
  };

  const buildWaUrl = (text: string) => {
    const dest = toE164ish(targetPhone);
    const encoded = encodeURIComponent(text);
    return `https://wa.me/${dest.replace(/^\+/, "")}?text=${encoded}`;
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const logEvent = async (type: "wa.reminder.sent" | "wa.rebook.sent", text: string) => {
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          lead_id: lead?.id || null,
          provider_id: provider?.id || null,
          meta: {
            via: "dashboard.actions",
            channel: "whatsapp",
            to: toE164ish(targetPhone),
            provider_slug: providerSlug || null,
            template_len: text.length,
          },
        }),
      });
    } catch (e) {
      console.log("[telemetry:fallback]", { type, lead_id: lead?.id, e: String(e) });
    }
  };

  const handleReminder = async () => {
    const text = tplReminder();
    const url = buildWaUrl(text);
    await logEvent("wa.reminder.sent", text);
    if (isMobile()) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      await copyText(text);
      setCopied("reminder");
      // Optionally open WA Web too:
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const handleRebook = async () => {
    const text = tplRebook();
    const url = buildWaUrl(text);
    await logEvent("wa.rebook.sent", text);
    if (isMobile()) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      await copyText(text);
      setCopied("rebook");
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleReminder}
        disabled={disabledBecauseNoPhone}
        title={disabledBecauseNoPhone ? "No phone on this lead (and no test number set)" : "Send WhatsApp reminder"}
        className={`px-2 py-1 rounded text-sm border
          ${disabledBecauseNoPhone ? "opacity-50 cursor-not-allowed" : "hover:shadow"}
        `}
      >
        Send WA Reminder
      </button>
      <button
        onClick={handleRebook}
        disabled={disabledBecauseNoPhone}
        title={disabledBecauseNoPhone ? "No phone on this lead (and no test number set)" : "Send WhatsApp rebooking ping"}
        className={`px-2 py-1 rounded text-sm border
          ${disabledBecauseNoPhone ? "opacity-50 cursor-not-allowed" : "hover:shadow"}
        `}
      >
        Send Rebooking Ping
      </button>

      {/* tiny inline feedback (we avoid alert boxes) */}
      {copied && (
        <span className="text-xs ml-1 opacity-80">{copied === "reminder" ? "Reminder copied" : "Rebooking copied"}</span>
      )}
    </div>
  );
}
