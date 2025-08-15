// @ts-nocheck
"use client";

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";

export default function OnboardingForm() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    const form = e.currentTarget as any;
    const payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      category: form.category.value.trim(),
      slug: form.slug.value.trim(),
    };

    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Always try to parse JSON
      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }

      if (!res.ok || !data?.ok) {
        const m = data?.error || `Publish failed (HTTP ${res.status})`;
        setErr(m);
        return;
      }

      // Success → go to dashboard with slug
      const nextSlug = data.slug || payload.slug;
      setMsg("Published! Redirecting…");
      window.location.href = `/dashboard?slug=${encodeURIComponent(nextSlug)}`;
    } catch (e: any) {
      setErr(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {err && <ErrorNotice title="Couldn’t publish" message={err} />}
      {msg && <div className="rounded-xl border bg-green-50 p-3 text-green-800">{msg}</div>}

      <label className="block text-sm font-medium">Name</label>
      <input name="name" required placeholder="e.g. Dr. Meera" className="w-full rounded-xl border p-2" />

      <label className="block text-sm font-medium">Phone</label>
      <input name="phone" required placeholder="+91…" className="w-full rounded-xl border p-2" />

      <label className="block text-sm font-medium">Category</label>
      <input name="category" required placeholder="Dentist / Yoga / …" className="w-full rounded-xl border p-2" />

      <label className="block text-sm font-medium">Slug (optional)</label>
      <input name="slug" placeholder="your-handle" className="w-full rounded-xl border p-2" />

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Publishing…" : "Publish"}
      </button>
    </form>
  );
}
