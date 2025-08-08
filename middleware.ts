// middleware.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: any) => res.cookies.set({ name, value: '', ...options, maxAge: 0 }),
      },
    }
  );

  const { pathname, search } = req.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate protected routes
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users shouldn’t see /login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/onboarding/:path*',
    // IMPORTANT: do NOT include /auth/callback here
  ],
};
