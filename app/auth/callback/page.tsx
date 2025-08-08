// app/auth/callback/page.tsx
// @ts-nocheck
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const codeRaw = sp.code;
  const code =
    typeof codeRaw === 'string'
      ? codeRaw
      : Array.isArray(codeRaw)
      ? codeRaw[0]
      : undefined;

  const nextRaw = sp.next;
  const next =
    typeof nextRaw === 'string'
      ? nextRaw
      : Array.isArray(nextRaw)
      ? nextRaw[0]
      : '/onboarding';

  const supabase = createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return redirect('/login?error=NoSession');
  }

  return redirect(next);
}
