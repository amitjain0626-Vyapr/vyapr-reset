// @ts-nocheck
"use client";

import { useState, useMemo } from "react";

function normalizePhoneForWA(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

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
  const [name, setName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waHref = useMemo(() => {
    const waNumber = normalizePhoneForWA(whatsapp ?? phone ?? "");
    if (!waNumber) return null;
    const waText = encodeURIComponent(
      `Hi ${providerName}, I submitted a booking request from your Vyapr page (${pageUrl}).`
    );
    return `https://wa.me/${waNumber}?text=${waText}`;
  }, [whatsapp, phone, providerName, pageUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
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
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Thanks! Your request was sent.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You’ll get a confirmation on WhatsApp/SMS soon.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:opacity-95"
            >
              Continue on WhatsApp
            </a>
          )}
          <a href={pageHref} className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-muted/50">
            Back to profile
          </a>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-5">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="block text-xs text-gray-500">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Your full name"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500">Phone</label>
        <input
          value={userPhone}
          onChange={(e) => setUserPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="+91XXXXXXXXXX"
          required
          inputMode="tel"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Share any preference (date, time, service)…"
          rows={3}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
