import { createClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient();

  const { error } = await supabase.auth.getUser();

  // If user session is found, redirect to dashboard
  if (!error) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If something failed, fallback to login
  return NextResponse.redirect(new URL('/login', request.url));
}
