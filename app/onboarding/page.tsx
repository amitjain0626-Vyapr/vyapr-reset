// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";

function toMsg(x: unknown): string {
  try {
    if (!x) return "Unknown error";
    if (typeof x === "string") return x;
    if (x instanceof Error) return x.message || String(x);
    return JSON.stringify(x, null, 2);
  } catch {
    return "Unexpected error";
  }
}

export default function OnboardingPage() {
  // VERSION: VYAPR-ONBOARDING-V4
  const [loading, setLoading] = useState(false);
  const [errText, setErrText] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    category: "",
    about: "",
    slug: "",
    published: true,
  });

  const autoSlug = useMemo(() => {
    const base = (form.name || "").trim().toLowerCase();
    return base.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);
  }, [form.name]);

  const finalSlug = (form.slug || autoSlug || "").trim();

  const onChange =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v =
        e.currentTarget.type === "checkbox"
          ? (e as any).currentTarget.checked
          : e.currentTarget.value;
      setForm((f) => ({ ...f, [k]: v as any }));
    };

  async function onPublish() {
    setLoading(true);
    setErrText(null);
    setMsg(null);

    if (!form.name.trim() || !form.phone.trim() || !form.category.trim()) {
      setErrText("Missing field: name, phone and category are required");
      setLoading(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      category: form.category.trim(),
      slug: finalSlug || undefined,
    };

    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      let json: any = {};
      try { json = await res.json(); } catch {}

      if (!res.ok || !json?.ok) {
        const msg =
          json?.error ||
          json?.message ||
          toMsg(json) ||
          `Publish failed (HTTP ${res.status})`;
        setErrText(msg);
        setLoading(false);
        return;
      }

      setMsg("Published! Redirecting…");
      const nextSlug = json.slug || payload.slug;
      window.location.href = `/dashboard?slug=${encodeURIComponent(nextSlug)}`;
    } catch (e: any) {
      setErrText(toMsg(e));
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Create your Vyapr microsite</h1>
      <p className="text-xs text-gray-500 mb-2">VYAPR-ONBOARDING-V4</p>
      <p className="text-sm text-gray-600">Name, phone, category → instant site with blurred preview.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Name" value={form.name} onChange={onChange("name")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Phone (+91…)" value={form.phone} onChange={onChange("phone")} />
        <input className="border rounded-xl px-3 py-2" placeholder="City" value={form.city} onChange={onChange("city")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Category (e.g., Dentist, Yoga Teacher)" value={form.category} onChange={onChange("category")} />
        <textarea className="md:col-span-2 border rounded-xl px-3 py-2 min-h-[90px]" placeholder="About" value={form.about} onChange={onChange("about")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Slug (optional)" value={form.slug} onChange={onChange("slug")} />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Final link will be</span>
          <code className="px-2 py-1 bg-gray-100 rounded">/d/{finalSlug || "your-name"}</code>
        </div>
        <label className="flex items-center gap-2 md:col-span-2 text-sm">
          <input type="checkbox" checked={!!form.published} onChange={onChange("published")} />
          <span>Published</span>
        </label>
      </div>

      <div className="space-y-3">
        <button onClick={onPublish} disabled={loading} className="rounded-2xl px-4 py-2 bg-black text-white disabled:opacity-70">
          {loading ? "Publishing…" : "Publish"}
        </button>

        {errText && (
          <div className="text-sm text-red-700 border border-red-200 rounded-md p-3 bg-red-50 whitespace-pre-wrap">
            {errText}
          </div>
        )}
        {msg && (
          <div className="text-sm text-green-700 border border-green-200 rounded-md p-3 bg-green-50">
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
