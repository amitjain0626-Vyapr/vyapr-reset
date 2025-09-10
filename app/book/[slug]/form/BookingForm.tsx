// app/book/[slug]/form/BookingForm.tsx
// @ts-nocheck
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function normalizePhoneForWA(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

async function logEvent(payload: {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source: Record<string, any>;
}) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {}
}

function toISOInIST(dateStr?: string, timeStr?: string) {
  if (!dateStr || !timeStr) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const [hh, mm] = (timeStr || "").split(":");
  return `${dateStr}T${pad(Number(hh || 0))}:${pad(Number(mm || 0))}:00+05:30`;
}

function formatISTStrict(iso?: string | null) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const [_, y, mo, d, h, mi] = m;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = Number(h);
  const mm = Number(mi);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hr12 = ((hh + 11) % 12) + 1;
  return `${d} ${months[Number(mo)-1]} ${y}, ${String(hr12).padStart(2,"0")}:${String(mm).padStart(2,"0")} ${ampm} IST`;
}

type MeetingMode = "in_person" | "phone" | "google_meet";

export default function BookingForm({
  slug,
  providerName,
  pageHref,
  phone,
  whatsapp,
  pageUrl,
}: {
  slug: string;
  providerName: string;
  pageHref: string;
  phone?: string | null;
  whatsapp?: string | null;
  pageUrl: string;
}) {
  const router = useRouter();

  // ---------------- Query presets ----------------
  const { presetLeadId, presetService, presetSlotISO, presetLoc, presetMeet } = useMemo(() => {
    if (typeof window === "undefined")
      return {
        presetLeadId: null,
        presetService: null,
        presetSlotISO: null,
        presetLoc: null,
        presetMeet: null,
      };
    const q = new URLSearchParams(window.location.search);
    return {
      presetLeadId: q.get("lid"),
      presetService: q.get("svc"),
      presetSlotISO: q.get("slot"),
      presetLoc: q.get("loc"),
      presetMeet: q.get("meet"),
    };
  }, []);

  // ---------------- State ----------------
  const [name, setName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [note, setNote] = useState("");
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("in_person");

  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  // ✅ Initialize meetLink from presetMeet
  const [meetLink, setMeetLink] = useState<string>(presetMeet || "");

  const [slotTouched, setSlotTouched] = useState(false);
  const [locTouched, setLocTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pricing, setPricing] = useState<{ [k in MeetingMode]?: number }>({});
  const [amount, setAmount] = useState<number | null>(null);

  const waHref = useMemo(() => {
    const waNumber = normalizePhoneForWA(whatsapp ?? phone ?? "");
    if (!waNumber) return null;
    const waText = encodeURIComponent(`Hi ${providerName}, I submitted a booking request from your Korekko page (${pageUrl}).`);
    return `https://wa.me/${waNumber}?text=${waText}`;
  }, [whatsapp, phone, providerName, pageUrl]);

  const [leadId, setLeadId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => { if (presetLeadId) setLeadId(presetLeadId); }, [presetLeadId]);

  // Prefill slot/location from presets
  useEffect(() => {
    if (presetSlotISO && !slotTouched) {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(presetSlotISO);
      if (m) {
        const [, y, mo, d, h, mi] = m;
        setDate(`${y}-${mo}-${d}`);
        setTime(`${h}:${mi}`);
      }
    }
    if (presetLoc && !locTouched) setLocation(presetLoc);
  }, [presetSlotISO, presetLoc, slotTouched, locTouched]);

  // Fetch latest pricing
  useEffect(() => {
    async function fetchPricing() {
      try {
        const res = await fetch(`/api/debug/events?event=provider.pricing.saved&limit=50&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await res.json();
        const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
        const latest = rows.filter((r) => String(r?.provider_id)).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
        if (latest?.source) {
          setPricing({
            in_person: Number(latest.source.in_person) || undefined,
            phone: Number(latest.source.phone) || undefined,
            google_meet: Number(latest.source.google_meet) || undefined,
          });
        }
      } catch {}
    }
    fetchPricing();
  }, [slug]);

  // Bridge: sync with SlotPicker
  useEffect(() => {
    const applyISO = (iso: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
      if (!m) return;
      const [, y, mo, d, h, mi] = m;
      setDate(`${y}-${mo}-${d}`);
      setTime(`${h}:${mi}`);
      setSlotTouched(true);
    };

    let last = "";
    const iv = setInterval(() => {
      const el = document.querySelector('input[name="slotISO"]') as HTMLInputElement | null;
      const val = el?.value || "";
      if (val && val !== last) {
        last = val;
        applyISO(val);
      }
    }, 250);

    const onCustom = (e: any) => {
      const iso = e?.detail?.iso;
      if (typeof iso === "string" && iso.length > 10) applyISO(iso);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "vyapr.selectedSlot" && e.newValue) applyISO(e.newValue);
    };

    document.addEventListener("vyapr:slot-selected", onCustom as any);
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(iv);
      document.removeEventListener("vyapr:slot-selected", onCustom as any);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }, []);

  const selectedISO = useMemo(() => toISOInIST(date, time) || presetSlotISO || null, [date, time, presetSlotISO]);

  function computedLocation(): string | null {
    if (locTouched && location.trim()) return location.trim();
    return (presetLoc || location || "").trim() || null;
  }

  useEffect(() => { setAmount(pricing[meetingMode] ?? null); }, [meetingMode, pricing]);

  async function onModeChange(next: MeetingMode) {
    setMeetingMode(next);
    await logEvent({
      event: "meeting.mode.chosen",
      ts: Date.now(),
      provider_id: providerId ?? null,
      lead_id: leadId ?? null,
      source: { via: "web", slug, mode: next, trigger: "toggle" },
    });
  }

  async function handleBookingConfirmed(eitherLeadId: string, maybeProviderId?: string | null) {
    await logEvent({
      event: "booking.confirmed",
      ts: Date.now(),
      provider_id: maybeProviderId ?? providerId ?? null,
      lead_id: eitherLeadId,
      source: {
        via: "web",
        service: presetService ?? (note?.trim() ? "unspecified" : "unspecified"),
        amount: amount ?? null,
        meeting_mode: meetingMode,
        slotISO: selectedISO ?? null,
        location: computedLocation() ?? null,
        meet: meetingMode === "google_meet" ? (meetLink?.trim() || null) : null,
      },
    });
  }

  function goToPay(eitherLeadId: string) {
    const params = new URLSearchParams();
    params.set("slug", slug);
    if (amount !== null) params.set("amount", String(amount));
    params.set("mode", meetingMode);
    params.set("enableInPerson", "1");
    if (selectedISO) params.set("slot", selectedISO);
    const loc = computedLocation();
    if (loc) params.set("loc", loc);
    if (meetingMode === "google_meet" && meetLink?.trim()) params.set("meet", meetLink.trim());
    router.push(`/pay/${eitherLeadId}?${params.toString()}`);
  }

  // ---- NEW: server-side slot validation before creating/using a lead
  async function validateSlotOrFail(): Promise<void> {
    const iso = selectedISO;
    if (!iso) {
      throw new Error("Please pick a date & time.");
    }
    try {
      const res = await fetch("/api/booking/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, slotISO: iso }),
      });
      const j = await res.json();
      if (!j?.ok) {
        if (j?.error === "slot_in_past") throw new Error("That time is already past. Please choose a future slot.");
        if (j?.error === "slot_out_of_hours") {
          const start = j?.detail?.startHour ?? 10;
          const end = j?.detail?.endHour ?? 19;
          throw new Error(`This provider accepts bookings between ${String(start).padStart(2,"0")}:00 and ${String(end).padStart(2,"0")} IST.`);
        }
        throw new Error("This time isn’t available. Please pick another slot.");
      }
    } catch (e: any) {
      const msg = e?.message || "Could not validate the selected time.";
      throw new Error(msg);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // ✅ hard gate: validate slot server-side (IST & provider-hours)
      await validateSlotOrFail();

      if (presetLeadId) {
        await handleBookingConfirmed(presetLeadId);
        setLeadId(presetLeadId);
        goToPay(presetLeadId);
        return;
      }

      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patient_name: name.trim(),
          phone: userPhone.trim(),
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to submit");

      const createdLeadId = json.id || null;
      const createdProviderId = json.provider_id || null;
      setLeadId(createdLeadId);
      if (createdProviderId) setProviderId(createdProviderId);

      if (createdLeadId) {
        await handleBookingConfirmed(createdLeadId, createdProviderId);
        goToPay(createdLeadId);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-5">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Meeting mode */}
      <div>
        <div className="block text-xs text-gray-500 mb-1">How would you like to meet?</div>
        <div className="flex flex-wrap gap-2">
          <label className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer ${meetingMode === "in_person" ? "bg-emerald-50 border-emerald-300" : ""}`}>
            <input type="radio" name="meeting_mode" className="sr-only" checked={meetingMode === "in_person"} onChange={() => onModeChange("in_person")} />
            In person
          </label>
          <label className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer ${meetingMode === "phone" ? "bg-emerald-50 border-emerald-300" : ""}`}>
            <input type="radio" name="meeting_mode" className="sr-only" checked={meetingMode === "phone"} onChange={() => onModeChange("phone")} />
            Phone call
          </label>
          <label className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer ${meetingMode === "google_meet" ? "bg-emerald-50 border-emerald-300" : ""}`}>
            <input type="radio" name="meeting_mode" className="sr-only" checked={meetingMode === "google_meet"} onChange={() => onModeChange("google_meet")} />
            Google Meet (online)
          </label>
        </div>
      </div>

      {/* Slot + loc */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500">Date</label>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotTouched(true); }} className="mt-1 w-full rounded-lg border px-3 py-2" required />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Time</label>
          <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setSlotTouched(true); }} className="mt-1 w-full rounded-lg border px-3 py-2" required />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Location (for in-person)</label>
        <input value={location} onChange={(e) => { setLocation(e.target.value); setLocTouched(true); }} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g., DLF Cyberhub, Gurugram" />
      </div>

      {/* ✅ Google Meet link always honors preset */}
      {meetingMode === "google_meet" && (
        <div>
          <label className="block text-xs text-gray-500">Google Meet link</label>
          <input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="https://meet.google.com/xxx-xxxx-xxx" />
          <p className="text-[11px] text-gray-500 mt-1">Enter your Meet link (preset will auto-fill if present).</p>
        </div>
      )}

      {/* Contact */}
      <div>
        <label className="block text-xs text-gray-500">Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Your full name" required={!presetLeadId} />
      </div>
      <div>
        <label className="block text-xs text-gray-500">Phone</label>
        <input value={userPhone} onChange={(e) => setUserPhone(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="+91XXXXXXXXXX" required={!presetLeadId} inputMode="tel" />
      </div>
      <div>
        <label className="block text-xs text-gray-500">Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={3} />
      </div>

      {/* Summary */}
      <div className="rounded-xl border px-3 py-2 text-sm bg-gray-50 space-y-1">
        <div><span className="text-gray-500">Selected slot:</span>{" "} <span className="font-mono">{formatISTStrict(selectedISO) || "—"}</span></div>
        {meetingMode === "google_meet" && (
          <div className="mt-1">
            <span className="text-gray-500">GMeet:</span>{" "}
            <span className="underline break-all">{meetLink?.trim() || "(none provided)"}</span>
          </div>
        )}
        {meetingMode === "in_person" && (computedLocation()?.length ?? 0) > 0 && (
          <div className="mt-1"><span className="text-gray-500">Location:</span>{" "} <span className="break-all font-mono">{computedLocation()}</span></div>
        )}
        {amount !== null && (
          <div className="mt-1"><span className="text-gray-500">Price:</span>{" "} <span className="font-mono">₹{amount}</span></div>
        )}
      </div>

      <div className="pt-2">
        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold disabled:opacity-60">
          {submitting ? "Submitting…" : "Confirm & Proceed to Payment"}
        </button>
      </div>

      {waHref && (
        <div className="text-xs text-gray-500">
          Prefer WhatsApp?{" "}
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="underline">Continue on WhatsApp</a>
        </div>
      )}
    </form>
  );
}
