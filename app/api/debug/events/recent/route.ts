// app/api/debug/events/recent/route.ts
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const event = (url.searchParams.get('event') || '').trim(); // optional
    const provider_id = (url.searchParams.get('provider_id') || '').trim(); // optional
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10)));

    let q = admin()
      .from('Events')
      .select('event, ts, provider_id, lead_id, source')
      .order('ts', { ascending: false })
      .limit(limit);

    if (event) q = q.eq('event', event);
    if (provider_id) q = q.eq('provider_id', provider_id);

    const { data = [], error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, count: data.length, rows: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server_error' }, { status: 500 });
  }
}
