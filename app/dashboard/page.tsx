// @ts-nocheck
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function Dashboard() {
  const cookieStore = cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data } = await supabase.auth.getSession();
  if (!data.session) redirect('/login');

  const email = data.session.user.email ?? 'user';

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
