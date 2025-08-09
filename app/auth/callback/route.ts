// app/auth/callback/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');              // OAuth/PKCE flow
  const token_hash = url.searchParams.get('token_hash');  // Magic-link/confirm flow
  const type = (url.searchParams.get('type') || 'magiclink') as
    | 'magiclink' | 'signup' | 'recovery' | 'email_change';
  const next = url.searchParams.get('next') || '/onboarding';

  // Prepare a mutable response for cookie writes
  const res = NextResponse.redirect(new URL(next, url.origin), { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => res.cookies.set({ name, value, ...options }),
        remove: (name: string, value?: string, options?: any) =>
          res.cookies.set({ name, value: '', ...(options || {}), maxAge: 0 }),
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin), { status: 303 });
    }
  } else if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin), { status: 303 });
    }
  } else {
    return NextResponse.redirect(new URL('/login?error=MissingToken', url.origin), { status: 303 });
  }

  // Sanity check
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return NextResponse.redirect(new URL('/login?error=NoSession', url.origin), { status: 303 });
  }

  return res;
}
