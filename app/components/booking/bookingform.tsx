// components/booking/BookingForm.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function BookingForm({
  slug,
  utm,
}: {
  slug: string;
  utm?: Record<string, string>;
}) {
  const router = useRouter();
  const [patient_name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function cleanPhone(v: string) {
    return v.replace(/[^\d+]/g, '');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const p = cleanPhone(phone);
    if (!patient_name || p.length < 10) {
      setError('Please enter your name and a valid phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          patient_name,
          phone: p,
          note,
          utm: utm || {},
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Could not submit. Please try again.');
      }
      router.push(`/thank-you?slug=${encodeURIComponent(slug)}`);
    } catch (err: any) {
      setError(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <label className="block">
        <div className="text-sm font-medium mb-1">Your name</div>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={patient_name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Riya Sharma"
          required
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Phone</div>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98xxxxxxx"
          inputMode="tel"
          required
        />
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Note (optional)</div>
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Share any details or preferred time…"
          rows={3}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
      >
        {submitting ? 'Booking…' : 'Book Appointment'}
      </button>
    </form>
  );
}
