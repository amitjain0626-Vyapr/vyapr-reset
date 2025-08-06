import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { data: profile } = await supabase
    .from('Dentists')
    .select('slug')
    .eq('id', data.session.user.id)
    .single();

  // Redirect to onboarding if slug not set and trying to access dashboard
  if (!profile?.slug && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
