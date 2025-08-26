// app/api/debug/leads/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get('slug') || '').trim();
    if (!slug) return NextResponse.json({ ok: false, error: 'missing_slug' }, { status: 400 });

    const sb = admin();

    // 1) Resolve provider
    const { data: prov, error: pErr } = await sb
      .from('Providers')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    if (pErr || !prov?.id) {
      return NextResponse.json({ ok: false, error: 'provider_not_found', slug }, { status: 404 });
    }

    // 2) Count + sample leads via service role (bypasses RLS)
    const { count, error: cErr } = await sb
      .from('Leads')
      .select('id', { head: true, count: 'exact' })
      .eq('provider_id', prov.id);

    if (cErr) {
      return NextResponse.json({ ok: false, error: 'count_failed' }, { status: 500 });
    }

    const { data: rows = [], error: rErr } = await sb
      .from('Leads')
      .select('id, patient_name, phone, status, created_at')
      .eq('provider_id', prov.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (rErr) {
      return NextResponse.json({ ok: false, error: 'rows_failed' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      slug,
      provider_id: prov.id,
      count,
      sample: rows,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}
