import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip middleware for public routes
  const publicPaths = [
    '/login',
    '/auth/callback',
    '/manifest.json',
    '/favicon.ico',
    '/_next', // for static files
  ];

  const isPublic = publicPaths.some((path) => req.nextUrl.pathname.startsWith(path));
  if (isPublic) {
    return res;
  }

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
