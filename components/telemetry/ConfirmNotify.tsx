// components/telemetry/ConfirmNotify.tsx
// @ts-nocheck
"use client";

import { useMemo, useState } from "react";

async function logEvent(payload: {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source: Record<string, any>;
}) {
  await fetch("/api/events/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

function parseQuerySlot() {
  try {
    const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const slot = q.get("slot") || ""; // ISO like 2025-09-01T10:00:00+05:30
    const loc = q.get("loc") || "";   // optional location string
    return { slot, loc };
  } catch {
    return { slot: "", loc: "" };
  }
}

function formatIST(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // Format as e.g. "31 Aug 2025, 04:00 PM IST"
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST";
  } catch {
    return iso;
  }
}

function googleCalendarUrl({
  title,
  details,
  location,
  startISO,
  durationMin = 30,
}: {
  title: string;
  details: string;
  location?: string;
  startISO?: string;
  durationMin?: number;
}) {
  if (!startISO) return null;
  try {
    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z"); // YYYYMMDDTHHMMSSZ

    const text = encodeURIComponent(title);
    const dates = `${fmt(start)}/${fmt(end)}`;
    const det = encodeURIComponent(details);
    const loc = encodeURIComponent(location || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${det}&location=${loc}`;
  } catch {
    return null;
  }
}

function buildMessage({
  mode,
  meetLink,
  amount,
  providerSlug,
  slotISO,
  location,
}: {
  mode?: "in_person" | "phone" | "google_meet";
  meetLink?: string;
  amount?: number;
  providerSlug?: string;
  slotISO?: string;
  location?: string;
}) {
  const amt = Number.isFinite(amount as any) ? `Amount: ₹${amount}\n` : "";
  const slotLine = slotISO ? `Slot: ${formatIST(slotISO)}\n` : "";
  const locLine =
    mode === "in_person" ? `Location: ${location || "Provider will share the address"}\n` : "";

  if (mode === "google_meet") {
    return `Your appointment is confirmed.\n${amt}${slotLine}Join on Google Meet: ${meetLink || "(link will be shared)"}\n— ${providerSlug || "Provider"}`;
  }
  if (mode === "phone") {
    return `Your appointment is confirmed.\n${amt}${slotLine}You’ll receive a phone call at the scheduled time.\n— ${providerSlug || "Provider"}`;
  }
  return `Your appointment is confirmed.\n${amt}${slotLine}${locLine}See you at the scheduled time.\n— ${providerSlug || "Provider"}`;
}

export default function ConfirmNotify({
  leadId,
  providerSlug,
  providerId,
  mode,
  meetLink,
  amount,
  toPhone, // optional: customer phone, if known
  slotISO: slotISOProp, // optional prop; if not passed, we read from ?slot=
  location: locationProp, // optional prop; if not passed, we read from ?loc=
}: {
  leadId: string;
  providerSlug?: string;
  providerId?: string;
  mode?: "in_person" | "phone" | "google_meet";
  meetLink?: string;
  amount?: number;
  toPhone?: string;
  slotISO?: string;
  location?: string;
}) {
  const [working, setWorking] = useState<null | "confirm" | "wa" | "cal">(null);
  const [doneConfirm, setDoneConfirm] = useState(false);
  const [doneWA, setDoneWA] = useState(false);
  const [doneCal, setDoneCal] = useState(false);

  const { slot, loc } = parseQuerySlot();
  const slotISO = slotISOProp || slot || "";
  const location = locationProp || loc || "";

  const message = useMemo(
    () => buildMessage({ mode: (mode as any) || "in_person", meetLink, amount, providerSlug, slotISO, location }),
    [mode, meetLink, amount, providerSlug, slotISO, location]
  );

  const calUrl = useMemo(() => {
    const title =
      mode === "google_meet"
        ? "Online consultation (Google Meet)"
        : mode === "phone"
        ? "Phone consultation"
        : "In-person appointment";
    const details = message;
    return googleCalendarUrl({ title, details, location, startISO: slotISO || undefined, durationMin: 30 });
  }, [mode, message, location, slotISO]);

  async function onLogConfirm() {
    if (working || doneConfirm) return;
    setWorking("confirm");

    await logEvent({
      event: "wa.booking.confirmed",
      ts: Date.now(),
      provider_id: providerId || null,
      lead_id: leadId || null,
      source: {
        via: "web",
        slug: providerSlug || null,
        mode: (mode as any) || "in_person",
        link: meetLink || null,
        amount: amount ?? null,
        slotISO: slotISO || null,
        location: location || null,
        message_preview: message,
      },
    });

    setDoneConfirm(true);
    setWorking(null);
  }

  async function onSendWA() {
    if (working || doneWA) return;
    setWorking("wa");

    await logEvent({
      event: "wa.booking.sent",
      ts: Date.now(),
      provider_id: providerId || null,
      lead_id: leadId || null,
      source: {
        via: "web",
        slug: providerSlug || null,
        mode: (mode as any) || "in_person",
        link: meetLink || null,
        amount: amount ?? null,
        slotISO: slotISO || null,
        location: location || null,
        to: toPhone || null,
      },
    });

    const text = encodeURIComponent(message);
    const waUrl = toPhone
      ? `https://wa.me/${encodeURIComponent(toPhone)}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    setDoneWA(true);
    setWorking(null);
  }

  async function onAddCalendar() {
    if (working || doneCal || !calUrl) return;
    setWorking("cal");

    await logEvent({
      event: "calendar.add.opened",
      ts: Date.now(),
      provider_id: providerId || null,
      lead_id: leadId || null,
      source: {
        via: "web",
        slug: providerSlug || null,
        mode: (mode as any) || "in_person",
        slotISO: slotISO || null,
        location: location || null,
        calendar: "google",
        url: calUrl,
      },
    });

    window.open(calUrl, "_blank", "noopener,noreferrer");
    setDoneCal(true);
    setWorking(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onLogConfirm}
        disabled={!!working || doneConfirm}
        className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${doneConfirm ? "opacity-60 cursor-default" : ""}`}
      >
        {doneConfirm ? "Confirmation logged ✅" : working === "confirm" ? "Working…" : "Log confirmation"}
      </button>

      <button
        onClick={onSendWA}
        disabled={!!working || doneWA}
        className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${doneWA ? "opacity-60 cursor-default" : ""}`}
      >
        {doneWA ? "WA opened ✅" : working === "wa" ? "Working…" : "Send via WhatsApp"}
      </button>

      <button
        onClick={onAddCalendar}
        disabled={!!working || doneCal || !calUrl}
        className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${doneCal ? "opacity-60 cursor-default" : ""}`}
        title={!calUrl ? "Add a slot to enable" : "Add to Google Calendar"}
      >
        {doneCal ? "Calendar opened ✅" : working === "cal" ? "Working…" : "Add to Calendar"}
      </button>
    </div>
  );
}
