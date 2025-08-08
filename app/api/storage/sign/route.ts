// app/api/storage/sign/route.ts
// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/utils/supabase/server';

export const runtime = 'nodejs';

type Body = {
  bucket: 'profiles' | 'clinics';
  path: string; // must start with `${auth.uid()}/...`
  expiresIn?: number; // seconds, default 3600
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.bucket || !body?.path) {
    return NextResponse.json({ ok: false, error: 'bucket & path required' }, { status: 400 });
  }

  // Owner guard: first segment must be the requesting user's UUID
  const firstSeg = body.path.split('/')[0];
  if (firstSeg !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden path' }, { status: 403 });
  }

  const expiresIn = Math.max(60, Math.min(60 * 60 * 24, body.expiresIn ?? 3600)); // 1 min to 24h
  const { data, error } = await supabase.storage
    .from(body.bucket)
    .createSignedUrl(body.path, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: 'sign failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
