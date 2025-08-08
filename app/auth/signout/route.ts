// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL('/login', request.url));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        const cookie = request.headers.get('cookie') ?? '';
        const match = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
        return match ? decodeURIComponent(match.split('=')[1]) : undefined;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set(name, value, options);
      },
      remove(name: string, options: any) {
        res.cookies.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });

  await supabase.auth.signOut();

  // hard-clear in case any cookie flags prevent deletion
  res.cookies.set('sb-access-token', '', { path: '/', maxAge: 0 });
  res.cookies.set('sb-refresh-token', '', { path: '/', maxAge: 0 });

  return res;
}
