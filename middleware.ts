import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 🔁 Forward root requests with magic link code to auth callback
  if (
    pathname === '/' &&
    (req.nextUrl.searchParams.has('code') ||
      req.nextUrl.searchParams.has('error_description'))
  ) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/auth/callback';
    return NextResponse.redirect(redirectUrl);
  }

  const res = NextResponse.next();

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/auth/callback' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api');

  if (isPublic) return res;

  const supabase = createMiddlewareSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!.*\\..*|_next|api).*)'],
};
