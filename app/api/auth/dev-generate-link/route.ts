// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/auth/dev-generate-link' }, { status: 200 });
}

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const proto =
    request.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    'localhost:3000';
  const baseUrl = `${proto}://${host}`;
  // Korekko flow: finalize on /auth/finish (not /auth/callback)
  const redirectTo = `${baseUrl}/auth/finish`;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'korekko-admin' } },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const props = data?.properties ?? {};
  let verifyUrl: string | null =
    props.action_link ??
    props.email_otp_link ??
    null;

  if (!verifyUrl && props.verification_token) {
    const u = new URL(`${SUPABASE_URL}/auth/v1/verify`);
    u.searchParams.set('token', props.verification_token);
    u.searchParams.set('type', 'magiclink');
    u.searchParams.set('redirect_to', redirectTo);
    verifyUrl = u.toString();
  }

  return NextResponse.json({ email, redirectTo, verifyUrl, _debug: props ?? null }, { status: 200 });
}
