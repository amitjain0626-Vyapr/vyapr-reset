// app/api/leads/export/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Lead = { id: string; patient_name?: string | null; phone?: string | null; status?: string | null; created_at?: string | null };

function applyFilters(rows: Lead[], q?: string, status?: string, sort?: string): Lead[] {
  let out = Array.isArray(rows) ? [...rows] : [];
  const qq = (q || '').trim().toLowerCase();
  if (qq) {
    out = out.filter(r =>
      (r.patient_name || '').toLowerCase().includes(qq) ||
      (r.phone || '').toLowerCase().includes(qq)
    );
  }
  if (status && status !== 'all') {
    out = out.filter(r => (r.status || 'new') === status);
  }
  if (sort === 'oldest') {
    out.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  } else {
    out.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }
  return out;
}

function toCsv(rows: Lead[]) {
  const header = ['id', 'patient_name', 'phone', 'status', 'created_at'];
  const esc = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[,"\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.id),
      esc(r.patient_name || ''),
      esc(r.phone || ''),
      esc(r.status || ''),
      esc(r.created_at || ''),
    ].join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get('slug') || '').trim();
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status') || 'all';
    const sort = searchParams.get('sort') || 'newest';

    if (!slug) {
      return NextResponse.json({ ok: false, error: 'missing_slug' }, { status: 400 });
    }

    const sb = admin();
    const { data: prov } = await sb.from('Providers').select('id,slug').eq('slug', slug).single();
    if (!prov?.id) return NextResponse.json({ ok: false, error: 'provider_not_found' }, { status: 404 });

    const { data: rows = [] } = await sb
      .from('Leads')
      .select('id, patient_name, phone, status, created_at')
      .eq('provider_id', prov.id)
      .order('created_at', { ascending: false })
      .limit(500);

    const filtered = applyFilters(rows, q, status, sort);
    const csv = toCsv(filtered);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads_${slug}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}
