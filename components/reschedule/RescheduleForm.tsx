// @ts-nocheck
"use client";

import { useCallback, useMemo, useState } from "react";
import SlotPicker from "@/components/slots/SlotPicker";

/* Format IST nicely for WA text */
function istPretty(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso));
  } catch { return ""; }
}

export default function RescheduleForm({
  slug,
  leadId,
  name,
  provider,
  startHour = 10,
  endHour = 19,
}: {
  slug: string;
  leadId: string;
  name: string;
  provider: string;
  startHour?: number;
  endHour?: number;
}) {
  const [slotISO, setSlotISO] = useState("");
  const [err, setErr] = useState("");

  const slotPretty = useMemo(() => istPretty(slotISO), [slotISO]);

  /* Polished, bilingual WA message */
  const waHref = useMemo(() => {
    const hi = name ? `नमस्ते ${name},` : "नमस्ते,";
    const enHi = name ? `Hi ${name},` : "Hi,";
    const bodyHi = [
      `${hi} आपकी नई समय वरीयता ${slotPretty || "चुना गया समय"} (IST) प्राप्त हुई।`,
      "हम जल्द पुष्टि करेंगे।",
      `— ${provider} • Korekko`
    ].join(" ");
    const bodyEn = [
      `${enHi} your reschedule request for ${slotPretty || "the selected slot"} (IST) has been received.`,
      "We’ll confirm shortly.",
      `— ${provider} (via Korekko)`
    ].join(" ");
    return `https://wa.me/?text=${encodeURIComponent(bodyHi + "\n\n" + bodyEn)}`;
  }, [name, provider, slotPretty]);

  // Fire-and-forget event log (non-blocking, soft-fail)
  const logReschedule = useCallback(async () => {
    if (!slotISO) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200); // never block UX
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "booking.reschedule.requested",
          provider_slug: slug,
          lead_id: leadId || null,
          source: { slotISO, via: "ui.reschedule.client" },
        }),
        keepalive: true,
        signal: ctrl.signal,
      }).catch(() => {});
      clearTimeout(t);
    } catch {}
  }, [slotISO, slug, leadId]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!slotISO) {
        setErr("Please pick a time first.");
        return;
      }
      setErr("");
      logReschedule();           // best-effort telemetry
      window.location.href = waHref; // redirect to WhatsApp
    },
    [slotISO, waHref, logReschedule]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="slotISO" value={slotISO} />

      <SlotPicker
        name="slotISO"
        startHour={startHour}
        endHour={endHour}
        onSelect={setSlotISO}
      />

      {err ? <div className="text-xs text-amber-700">{err}</div> : null}

      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
      >
        Confirm reschedule
      </button>
    </form>
  );
}
