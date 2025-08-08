// middleware.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding'];

export async function middleware(req: NextRequest) {
  // Clone headers to allow Supabase to attach/set cookies
  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  const url = req.nextUrl;
  const pathname = url.pathname;

  // Keep auth fresh on every hit to protected routes
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    pathname === '/login' || pathname.startsWith('/auth/callback');

  // If not logged in and hitting a protected route → send to /login with next=
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('next', pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and trying to access /login → send forward
  if (user && pathname === '/login') {
    // You can choose /dashboard if onboarding is complete; default to /onboarding
    const forward = new URL('/onboarding', url.origin);
    return NextResponse.redirect(forward);
  }

  return res;
}

export const config = {
  matcher: [
    // Apply to auth + protected pages; skip assets
    '/login',
    '/auth/callback',
    '/dashboard/:path*',
    '/onboarding/:path*',
  ],
};
