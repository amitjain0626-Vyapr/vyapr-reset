// app/api/leads/create/route.ts
// @ts-nocheck
export const runtime = 'nodejs'; // service-role key is NOT safe on edge
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function sanitizePhone(p: string) {
  // keep digits + leading '+', strip spaces/dashes
  const trimmed = p.replace(/[\s-]/g, '');
  if (!/^\+?\d{7,15}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const name = (body?.name ?? '').toString().trim();
    const phoneRaw = (body?.phone ?? '').toString().trim();
    const note = (body?.note ?? '').toString().trim();
    const slug = (body?.slug ?? body?.micrositeSlug ?? '').toString().trim().toLowerCase();

    if (!slug) return bad('Missing microsite slug');
    if (!name) return bad('Name is required');

    const phone = sanitizePhone(phoneRaw);
    if (!phone) return bad('Invalid phone number');

    // Resolve dentist by microsite slug
    const { data: dentist, error: dErr } = await supabaseAdmin
      .from('Dentists')
      .select('id, user_id, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (dErr) return bad('Dentist lookup failed', 500);
    if (!dentist) return bad('Microsite not found', 404);

    // Insert lead
    const payload: any = {
      owner_id: dentist.user_id,
      dentist_id: dentist.id ?? null,
      name,
      phone,
      note,
      microsite_slug: slug,
      source: 'microsite',
    };

    const { data: ins, error: iErr } = await supabaseAdmin
      .from('Leads')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (iErr) return bad('Could not create lead', 500);

    return NextResponse.json({ ok: true, id: ins?.id ?? null }, { status: 201 });
  } catch {
    return bad('Unexpected server error', 500);
  }
}
