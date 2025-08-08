'use client';
// @ts-nocheck

import React, { useState } from 'react';

export default function SettingsForm({ initial }: { initial: any }) {
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial.name || '',
    clinic_name: initial.clinic_name || '',
    phone: initial.phone || '',
    email: initial.email || '',
    address: initial.address || '',
    city: initial.city || '',
    services: initial.services || '',
    hours: initial.hours || '',
    profile_img_url: initial.profile_img_url || '',
    clinic_img_url: initial.clinic_img_url || '',
    published: initial.published !== false,
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch('/api/dentists/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Save failed');
      setOk('Saved');
    } catch (e: any) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setOk(null), 1800);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-md border p-4">
      {ok ? (
        <div className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-700">{ok}</div>
      ) : null}
      {err ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Your Name</label>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="Dr Amit Jain"
          />
        </div>
        <div>
          <label className="block text-sm">Clinic Name</label>
          <input
            value={form.clinic_name}
            onChange={(e) => update('clinic_name', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="SmileCare Dental"
          />
        </div>
        <div>
          <label className="block text-sm">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="+91…"
          />
        </div>
        <div>
          <label className="block text-sm">Email</label>
          <input
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="you@example.com"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm">Address</label>
          <input
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="Street, Locality"
          />
        </div>
        <div>
          <label className="block text-sm">City</label>
          <input
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="Gurugram"
          />
        </div>
        <div>
          <label className="block text-sm">Published</label>
          <div className="flex items-center gap-2">
            <input
              id="pub"
              type="checkbox"
              checked={form.published}
              onChange={(e) => update('published', e.target.checked)}
            />
            <label htmlFor="pub" className="text-sm">Visible on search & microsite</label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm">Services (comma separated)</label>
        <input
          value={form.services}
          onChange={(e) => update('services', e.target.value)}
          className="w-full border rounded-md p-2"
          placeholder="Cleaning, Whitening, Root Canal"
        />
      </div>

      <div>
        <label className="block text-sm">Business Hours</label>
        <textarea
          value={form.hours}
          onChange={(e) => update('hours', e.target.value)}
          className="w-full border rounded-md p-2"
          rows={3}
          placeholder="Mon-Fri 10:00-18:00; Sat 10:00-14:00"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Profile Image URL</label>
          <input
            value={form.profile_img_url}
            onChange={(e) => update('profile_img_url', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="https://…"
          />
        </div>
        <div>
          <label className="block text-sm">Clinic Image URL</label>
          <input
            value={form.clinic_img_url}
            onChange={(e) => update('clinic_img_url', e.target.value)}
            className="w-full border rounded-md p-2"
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-4 py-2"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
