// app/auth/callback/route.ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    redirect('/login');
  }

  const supabase = await createSupabaseServerClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    redirect('/login');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('Dentists')
    .select('slug')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    redirect('/login');
  }

  if (profile?.slug) {
    redirect('/dashboard');
  } else {
    redirect('/onboarding');
  }
}
