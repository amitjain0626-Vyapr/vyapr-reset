// app/auth/signout/route.ts
// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  // Best‑effort signout; even if it fails, clear cookies via adapter.
  await supabase.auth.signOut();

  const url = new URL('/login?signedout=1', req.url);
  return NextResponse.redirect(url, { status: 303 });
}
