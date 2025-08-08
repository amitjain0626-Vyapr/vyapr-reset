// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Callback() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const run = async () => {
      // Case A: PKCE / OAuth style → ?code=...
      const code = search.get('code');

      // Case B: Hash (implicit) style → #access_token=...&refresh_token=...
      const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const error = search.get('error') || hashParams.get('error');

      if (error) {
        router.replace('/login');
        return;
      }

      try {
        if (code) {
          // Exchange code on the client — avoids server cookie pitfalls in dev
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
          router.replace('/onboarding');
          return;
        }

        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) throw setErr;
          router.replace('/onboarding');
          return;
        }

        // Nothing usable → back to login
        router.replace('/login');
      } catch (_e) {
        router.replace('/login');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      <h1>Finishing sign‑in…</h1>
      <p>This should only take a moment.</p>
    </div>
  );
}
