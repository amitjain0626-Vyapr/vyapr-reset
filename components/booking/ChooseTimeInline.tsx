// components/booking/ChooseTimeInline.tsx
// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SlotPicker from "@/components/slots/SlotPicker";

export default function ChooseTimeInline({
  slug,
  startHour = 10,
  endHour = 19,
}: {
  slug: string;
  startHour?: number;
  endHour?: number;
}) {
  const [iso, setIso] = useState("");

  // update ?slotISO=… in URL (no reload) so downstream forms can read it
  useEffect(() => {
    const url = new URL(window.location.href);
    if (iso) url.searchParams.set("slotISO", iso); else url.searchParams.delete("slotISO");
    window.history.replaceState({}, "", url.toString());
  }, [iso]);

  // best-effort telemetry (non-blocking)
  const log = useCallback((value: string) => {
    if (!value) return;
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "booking.slot.selected", provider_slug: slug, source: { slotISO: value } }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  const onSelect = useCallback((value: string) => {
    setIso(value);
    log(value);
  }, [log]);

  const pretty = useMemo(() => {
    if (!iso) return "";
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso)) + " (IST)";
  }, [iso]);

  return (
    <section className="rounded-2xl border p-4 bg-white space-y-3">
      <h2 className="text-base font-semibold">Choose a time (IST)</h2>
      {/* NEW: pass providerSlug so SlotPicker enforces saved hours */}
      <SlotPicker
        name="slotISO"
        startHour={startHour}
        endHour={endHour}
        onSelect={onSelect}
        providerSlug={slug}
      />
      <div className="text-xs text-gray-600">
        {iso ? <>Selected: <strong>{pretty}</strong></> : "Pick a slot to proceed. Your selection will carry forward."}
      </div>
    </section>
  );
}
