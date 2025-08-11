// app/book/[slug]/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function BookPage() {
  const params = useParams();
  const router = useRouter();

  const routeSlug = useMemo(() => {
    const s = params?.slug;
    if (!s) return '';
    return Array.isArray(s) ? s[0] : s.toString();
  }, [params]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, note, slug: routeSlug }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) {
        setStatus('error');
        setErrorMsg(json?.error || `Request failed (${res.status})`);
        return;
      }

      // Redirect to thank-you page
      setStatus('success');
      router.push(`/book/${routeSlug}/thank-you`);
    } catch {
      setStatus('error');
      setErrorMsg('Network or server error');
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Request an appointment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Microsite: <span className="font-mono">{routeSlug || '(unknown)'}</span>
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="slug" value={routeSlug} />

        <div>
          <label className="block text-sm font-medium mb-1">Your name</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="e.g., Niharika"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="+91…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Note (optional)</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Share any details"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'loading' || !routeSlug}
          className="rounded-xl px-4 py-2 border"
        >
          {status === 'loading' ? 'Submitting…' : 'Submit request'}
        </button>

        {status === 'error' && (
          <p className="text-red-600 text-sm mt-2">{errorMsg || 'Something went wrong.'}</p>
        )}
        {!routeSlug && (
          <p className="text-amber-600 text-sm mt-2">
            Missing microsite slug in URL. Reload from a /book/[slug] link.
          </p>
        )}
      </form>

      <p className="mt-6 text-xs text-gray-400">
        By submitting, you agree to be contacted for appointment scheduling.
      </p>
    </main>
  );
}
