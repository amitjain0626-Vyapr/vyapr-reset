'use client';

import { useState, useTransition } from "react";

export default function ProfileForm({ initial }: { initial: any }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");

  const [form, setForm] = useState<any>({
    name: initial?.name || "",
    phone: initial?.phone || "",
    specialization: initial?.specialization || "",
    about: initial?.about || "",
    address_line1: initial?.address_line1 || "",
    address_line2: initial?.address_line2 || "",
    city: initial?.city || "",
    website: initial?.website || "",
    google_maps_link: initial?.google_maps_link || "",
    profile_image_url: initial?.profile_image_url || "",
    clinic_image_url: initial?.clinic_image_url || "",
    services: initial?.services || "",
    slug: initial?.slug || "",
    is_published: !!initial?.is_published || !!initial?.published || false,
  });

  function update<K extends keyof typeof form>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    start(async () => {
      const res = await fetch("/api/dentist/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) {
        setMsg(json?.error || `Failed (${res.status})`);
        return;
      }
      const saved = json.data;
      setMsg("Saved ✓");
      // reflect server truth
      setForm((f: any) => ({ ...f, slug: saved?.slug || f.slug }));
    });
  }

  const micrositeUrl = form.slug ? `/d/${form.slug}` : "";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.name} onChange={e=>update("name", e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.phone} onChange={e=>update("phone", e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Specialization</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.specialization} onChange={e=>update("specialization", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.city} onChange={e=>update("city", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">About</label>
        <textarea className="w-full rounded-lg border px-3 py-2" rows={4} value={form.about} onChange={e=>update("about", e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Address Line 1</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.address_line1} onChange={e=>update("address_line1", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address Line 2</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.address_line2} onChange={e=>update("address_line2", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.website} onChange={e=>update("website", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Google Maps Link</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.google_maps_link} onChange={e=>update("google_maps_link", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Profile Image URL</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.profile_image_url} onChange={e=>update("profile_image_url", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Clinic Cover URL</label>
          <input className="w-full rounded-lg border px-3 py-2" value={form.clinic_image_url} onChange={e=>update("clinic_image_url", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Services (comma or JSON array)</label>
        <textarea className="w-full rounded-lg border px-3 py-2" rows={3} value={form.services} onChange={e=>update("services", e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={form.is_published} onChange={e=>update("is_published", e.target.checked)} />
          Published
        </label>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-gray-600">Slug</div>
          <input className="rounded-lg border px-3 py-1 text-sm" value={form.slug} onChange={e=>update("slug", e.target.value)} placeholder="e.g., dr-kapoor" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl px-4 py-2 border">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {micrositeUrl ? (
          <a href={micrositeUrl} target="_blank" className="rounded-xl px-4 py-2 border">View microsite</a>
        ) : null}
        {msg ? <span className="text-sm text-green-700">{msg}</span> : null}
      </div>
    </form>
  );
}
