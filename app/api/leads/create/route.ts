// app/api/leads/create/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function sanitizePhone(s: string) {
  return (s || '').toString().replace(/[^\d+]/g, ''); // keep leading + and digits
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const slug = (body.slug || '').toString().trim();
    const patient_name = (body.patient_name || '').toString().trim();
    const phone = sanitizePhone(body.phone || '');
    const note = (body.note || '').toString();
    const source = body.source ?? { utm: {} };

    if (!slug) {
      return NextResponse.json({ ok: false, error: 'missing_slug' }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ ok: false, error: 'missing_phone' }, { status: 400 });
    }

    const sb = admin();

    // 1) resolve provider by slug
    const { data: prov, error: pErr } = await sb
      .from('Providers')
      .select('id, slug, display_name, published')
      .eq('slug', slug)
      .single();

    if (pErr || !prov?.id) {
      return NextResponse.json({ ok: false, error: 'provider_not_found' }, { status: 404 });
    }

    // Optional: only accept leads for published providers (fail-open if you prefer)
    // if (!prov.published) {
    //   return NextResponse.json({ ok: false, error: 'provider_unpublished' }, { status: 403 });
    // }

    // 2) insert into Leads (service role bypasses RLS safely)
    const insertLead = {
      provider_id: prov.id,
      patient_name,
      phone,
      note,
      status: 'new',
      source,
    };

    const { data: leadRow, error: lErr } = await sb
      .from('Leads')
      .insert(insertLead)
      .select('id')
      .single();

    if (lErr || !leadRow?.id) {
      return NextResponse.json({ ok: false, error: 'lead_insert_failed' }, { status: 500 });
    }

    // 3) telemetry: persist lead.created into Events
    const eventRow = {
      event: 'lead.created',
      ts: Date.now(),
      provider_id: prov.id,
      lead_id: leadRow.id,
      source: { via: 'api', ...source },
    };

    const { error: eErr } = await sb.from('Events').insert(eventRow);
    if (eErr) {
      // Do not fail the API if telemetry write fails — just log
      console.error('Events insert failed', eErr);
    }

    // 4) response: ok + deeplink for quick WA follow-up
    const msg = `Hi${patient_name ? ' ' + patient_name : ''}, thanks for reaching out. We’ll confirm your slot shortly.`;
    const whatsapp_url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

    return NextResponse.json({
      ok: true,
      id: leadRow.id,
      provider_slug: prov.slug,
      whatsapp_url,
    });
  } catch (e) {
    console.error('leads/create exception', e);
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}

export async function GET() {
  // healthcheck (avoid 404/405)
  return NextResponse.json({ ok: true });
}
