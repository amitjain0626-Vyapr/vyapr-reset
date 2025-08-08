"use client";
// @ts-nocheck
import { useState } from "react";

export default function BookingForm({ slug }: { slug: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
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
          ...form,
          source: "microsite",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setOkId(data?.lead?.id || "ok");
      setForm({ name: "", email: "", phone: "", message: "" });
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
          name="name"
          value={form.name}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          placeholder="Your name"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          placeholder="you@example.com"
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
        />
      </div>
      <div>
        <label className="block text-sm mb-1">Message</label>
        <textarea
          name="message"
          value={form.message}
          onChange={onChange}
          className="w-full border rounded-xl px-3 py-2"
          rows={3}
          placeholder="Tell us what you need"
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
