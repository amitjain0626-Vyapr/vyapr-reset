// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/onboarding');
      } else {
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/auth/magiclink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to send link');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: '56px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ marginBottom: 24, color: '#555' }}>
        Enter your email to receive a magic link.
      </p>

      {sent ? (
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <b>Check your email.</b> Click the magic link to finish sign‑in.
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="you@example.com"
            required
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ccc',
              marginBottom: 12, fontSize: 16,
            }}
          />
          <button
            type="submit"
            disabled={sending}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: '0',
              background: '#111', color: '#fff', fontSize: 16, cursor: 'pointer',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? 'Sending…' : 'Send Magic Link'}
          </button>
          {error && (
            <div style={{ marginTop: 12, color: '#b00020' }}>
              {error}
            </div>
          )}
        </form>
      )}
    </main>
  );
}
