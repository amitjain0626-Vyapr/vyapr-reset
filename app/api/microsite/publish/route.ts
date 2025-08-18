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
    if (typeof body?.published === 'boolean') {
      published = body.published;
    }
  } catch {}

  // Update Dentists.published for this owner
  const { data, error } = await supabase
    .from('Dentists')
    .update({ published })
    .eq('owner_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    // Bubble precise error for quick fixes
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // If no row updated (profile not created yet), be explicit
  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Dentist profile not found for this user' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
