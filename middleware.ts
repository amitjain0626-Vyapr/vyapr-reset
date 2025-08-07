import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Exclude public routes and static assets
  const publicRoutes = [
    '/login',
    '/auth/callback',
    '/manifest.json',
    '/favicon.ico',
  ];

  const pathname = req.nextUrl.pathname;

  const isPublic = publicRoutes.some((path) => pathname === path || pathname.startsWith('/_next'));

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

// ✅ Apply middleware only to app routes (not static files)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
};
