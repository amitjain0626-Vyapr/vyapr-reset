// components/slots/SlotPicker.tsx
// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { computeSlots } from "../../lib/slots/computeSlots"; // relative import (no "@/")

export default function SlotPicker({
  name = "slotISO",
  days = 14,
  startHour = 10,
  endHour = 19,
  stepMins = 30,
  tz = "Asia/Kolkata",
  onSelect,
  providerSlug,
}: {
  name?: string;
  days?: number;
  startHour?: number;
  endHour?: number;
  stepMins?: number;
  tz?: string;
  onSelect?: (iso: string) => void;
  providerSlug?: string;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedISO, setSelectedISO] = useState("");
  const [eff, setEff] = useState<{ start: number; end: number }>({ start: startHour, end: endHour });

  // Load provider hours if slug present
  useEffect(() => {
    let mounted = true;
    async function loadHours() {
      if (!providerSlug) {
        setEff({ start: startHour, end: endHour });
        return;
      }
      try {
        const idRes = await fetch(`/api/cron/nudges?slug=${encodeURIComponent(providerSlug)}`, { cache: "no-store" });
        const idJson = await idRes.json();
        const provider_id = idJson?.provider_id;
        if (!provider_id) {
          if (mounted) setEff({ start: startHour, end: endHour });
          return;
        }

        const evRes = await fetch(`/api/debug/events?event=provider.hours.saved&limit=100`, { cache: "no-store" });
        const evJson = await evRes.json();
        const rows: any[] = Array.isArray(evJson?.rows) ? evJson.rows : [];

        const latest = rows
          .filter((r) => String(r?.provider_id) === String(provider_id))
          .sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];

        if (mounted && latest?.source) {
          const sh = Number(latest.source.start_hour ?? startHour);
          const eh = Number(latest.source.end_hour ?? endHour);
          if (Number.isFinite(sh) && Number.isFinite(eh) && eh > sh) {
            setEff({ start: sh, end: eh });
            return;
          }
        }
        if (mounted) setEff({ start: startHour, end: endHour });
      } catch {
        if (mounted) setEff({ start: startHour, end: endHour });
      }
    }
    loadHours();
    return () => { mounted = false; };
  }, [providerSlug, startHour, endHour]);

  const rawDays = useMemo(
    () => computeSlots(days, eff.start, eff.end, stepMins),
    [days, eff.start, eff.end, stepMins]
  );

  const now = useMemo(() => new Date(), []);
  const daysArr = useMemo(() => {
    const filtered = (rawDays || []).map((d: any) => ({
      ...d,
      slots: (d?.slots || []).filter((s: any) => new Date(s.iso) >= now),
    }));
    return filtered.filter((d: any) => (d?.slots || []).length > 0);
  }, [rawDays, now]);

  useEffect(() => {
    if (dayIndex >= daysArr.length) setDayIndex(0);
  }, [daysArr.length, dayIndex]);

  const slots = daysArr[dayIndex]?.slots || [];

  // Reset when day changes
  useEffect(() => {
    setSelectedISO("");
    if (onSelect) onSelect("");
  }, [dayIndex]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(new Date(iso));

  const choose = (iso: string) => {
    setSelectedISO(iso);
    if (onSelect) onSelect(iso);
    // Bridge for BookingForm
    try { localStorage.setItem("vyapr.selectedSlot", iso); } catch {}
    try { document.dispatchEvent(new CustomEvent("vyapr:slot-selected", { detail: { iso } })); } catch {}
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">
        All times are shown in <strong>IST</strong>.
      </div>

      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {daysArr.map((d: any, i: number) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setDayIndex(i)}
            className={`px-3 py-2 rounded-lg border text-sm whitespace-nowrap ${
              i === dayIndex ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
            }`}
          >
            {d.label}
          </button>
        ))}
        {daysArr.length === 0 ? (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            No future slots available today — try later or different hours.
          </span>
        ) : null}
      </div>

      {/* Time slots */}
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s: any) => (
          <button
            key={s.iso}
            type="button"
            onClick={() => choose(s.iso)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              selectedISO === s.iso ? "bg-emerald-600 text-white" : "bg-white hover:bg-gray-50"
            }`}
            aria-label={`Choose ${fmt(s.iso)} IST`}
          >
            {fmt(s.iso)}
          </button>
        ))}
      </div>

      {/* Hidden input still present for legacy forms */}
      <input type="hidden" name={name} value={selectedISO} />
      {/* ❌ Removed duplicate “Selected …” line */}
    </div>
  );
}
