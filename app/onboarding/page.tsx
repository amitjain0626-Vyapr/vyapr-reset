// app/onboarding/page.tsx
// @ts-nocheck
"use client";

import { useCallback, useMemo, useState } from "react";

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [about, setAbout] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [website, setWebsite] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [gmaps, setGmaps] = useState("");
  const [services, setServices] = useState("");
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");

  // Auto-suggest slug from name
  const autoSlug = useMemo(() => (slug ? slugify(slug) : slugify(name)), [slug, name]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          city,
          category,
          about,
          address_line1: address1,
          address_line2: address2,
          website,
          photo_url: photoUrl,
          cover_url: coverUrl,
          gmaps,
          services,
          published,
          slug: autoSlug,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const msg = data?.details || data?.error || "Could not create profile. Try another phone or name.";
        alert(msg);
        return;
      }

      // Success → go to dashboard
      const next = data.next || `/dashboard?slug=${encodeURIComponent(data.slug || autoSlug)}`;
      window.location.href = next;
    } catch (err: any) {
      alert("Could not create profile. Try another phone or name.");
    } finally {
      setBusy(false);
    }
  }, [busy, name, phone, city, category, about, address1, address2, website, photoUrl, coverUrl, gmaps, services, published, autoSlug]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Create your Vyapr microsite</h1>
      <p className="mt-1 text-gray-600">Name, phone, category → instant site with blurred preview.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-700">Name</label>
          <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                 value={name} onChange={e=>setName(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm text-gray-700">Phone</label>
          <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                 value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98XXXXXXX" required />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">City</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={city} onChange={e=>setCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Category</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={category} onChange={e=>setCategory(e.target.value)} placeholder="Dentist, Nutritionist…" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-700">About</label>
          <textarea className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                    rows={4} value={about} onChange={e=>setAbout(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">Address Line 1</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={address1} onChange={e=>setAddress1(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Address Line 2</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={address2} onChange={e=>setAddress2(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">Website</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={website} onChange={e=>setWebsite(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Google Maps Link</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={gmaps} onChange={e=>setGmaps(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">Profile Image URL</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Clinic Cover URL</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">Services (comma/JSON)</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={services} onChange={e=>setServices(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Slug (optional)</label>
            <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                   value={slug} onChange={e=>setSlug(e.target.value)} placeholder="auto from name" />
            <p className="mt-1 text-xs text-gray-500">Final link will be <code>/d/{autoSlug || "your-name"}</code></p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} />
          Published
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy || !name || !phone}
            className="rounded-xl bg-teal-600 px-4 py-2 text-white shadow hover:bg-teal-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save / Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}
