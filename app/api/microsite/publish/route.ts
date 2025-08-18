// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  let published = true;
  try {
    const body = await req.json();
    if (typeof body?.published === 'boolean') published = body.published;
  } catch {}

  // 1) Try update existing row
  const { data: upd, error: updErr } = await supabase
    .from('Providers')
    .update({ published })
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
  }

  if (upd) {
    return NextResponse.json({ ok: true });
  }

  // 2) If no row exists, create one (upsert behavior)
  const fallbackDisplayName =
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'New User');

  const { data: ins, error: insErr } = await supabase
    .from('Providers')
    .insert({
      owner_id: user.id,
      display_name: fallbackDisplayName,
      slug: null,        // set later in settings
      published,         // true on publish
    })
    .select('id')
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
