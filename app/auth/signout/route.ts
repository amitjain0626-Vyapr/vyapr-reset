// app/auth/signout/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  // Clear the Supabase auth cookie
  cookieStore.set({
    name: 'sb-access-token',
    value: '',
    maxAge: 0,
    path: '/',
  });
  cookieStore.set({
    name: 'sb-refresh-token',
    value: '',
    maxAge: 0,
    path: '/',
  });

  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL));
}
