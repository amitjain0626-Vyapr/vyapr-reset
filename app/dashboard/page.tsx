// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
        return;
      }
      setEmail(data.session.user.email ?? 'user');
      setLoading(false);
    })();
  }, [router]);

  if (loading) return null;

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Dashboard</h1>
      <p>Signed in as {email}</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link href="/onboarding">Back to onboarding</Link>
        <a href="/auth/signout">Sign out</a>
      </div>
    </main>
  );
}
