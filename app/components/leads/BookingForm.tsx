"use client";
// @ts-nocheck
import { useState } from "react";

export default function BookingForm({ slug }: { slug: string }) {
  const [form, setForm] = useState({
    patient_name: "",
    phone: "",
    note: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [okId, setOkId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    setOkId(null);
    setErr(null);
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patient_name: form.patient_name,
          phone: form.phone,
          note: form.note,
          utm: {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed");
      setOkId(data?.lead?.id || "ok");
      setForm({ patient_name: "", email: "", phone: "", note: "" });
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm mb-1">Name</label>
        <input
          name="patient_name"
          value={form.patient_name}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          placeholder="Your name"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Phone</label>
        <input
          name="phone"
          value={form.phone}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          placeholder="+91…"
          inputMode="tel"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Note (optional)</label>
        <textarea
          name="note"
          value={form.note}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          rows={3}
          placeholder="Tell us what you need"
        />
      </div>

      {/* keep email if you want to collect it (not sent to leads API now) */}
      <div>
        <label className="block text-sm mb-1">Email (optional)</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-xl border"
      >
        {submitting ? "Sending…" : "Request a callback"}
      </button>

      {okId && <div className="text-sm">✅ Request sent. Ref: <b>{okId}</b></div>}
      {err && <div className="text-sm text-red-600">✗ {err}</div>}
    </form>
  );
}
