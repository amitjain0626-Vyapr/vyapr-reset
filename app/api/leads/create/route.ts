// app/api/leads/create/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

/** ---------- Supabase (service role) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** ---------- Utils ---------- */
function sanitizePhone(s: string) {
  // keep leading + and digits only (no spaces, dashes, etc.)
  return (s || '').toString().replace(/[^\d+]/g, '');
}

// Fallback-safe event logger: tries multiple column shapes so we work with whatever schema exists.
// Primary preference: { event, ts, provider_id, lead_id, source, meta }
// Fallbacks tried if columns differ: { type }, { event_name }, { name }, and { occurred_at } for ts, etc.
async function safeLogEvent(sb: any, payload: {
  name: string;                 // e.g., 'lead.created'
  ts?: string | Date | number;  // optional; defaults to now
  provider_id?: string | null;
  lead_id?: string | null;
  source?: any;                 // stored either in source or inside meta.source
  meta?: any;                   // optional extra metadata
}) {
  const isoTs =
    typeof payload.ts === 'string'
      ? payload.ts
      : payload.ts instanceof Date
        ? payload.ts.toISOString()
        : new Date().toISOString();

  // Candidate shapes to match unknown DB schemas
  const base = {
    lead_id: payload.lead_id ?? null,
    provider_id: payload.provider_id ?? null,
  };

  const candidates = [
    // Preferred (what we intended originally)
    { ...base, event: payload.name, ts: isoTs, source: payload.source ?? null, meta: payload.meta ?? {} },

    // Common alternates we’ve seen
    { ...base, type: payload.name, ts: isoTs, source: payload.source ?? null, meta: payload.meta ?? {} },
    { ...base, event_name: payload.name, ts: isoTs, source: payload.source ?? null, meta: payload.meta ?? {} },
    { ...base, name: payload.name, ts: isoTs, source: payload.source ?? null, meta: payload.meta ?? {} },

    // Some teams use occurred_at / data instead of ts / source
    { ...base, event: payload.name, occurred_at: isoTs, data: payload.source ?? null, meta: payload.meta ?? {} },
    { ...base, type: payload.name, occurred_at: isoTs, data: payload.source ?? null, meta: payload.meta ?? {} },
    { ...base, event_name: payload.name, occurred_at: isoTs, data: payload.source ?? null, meta: payload.meta ?? {} },
    { ...base, name: payload.name, occurred_at: isoTs, data: payload.source ?? null, meta: payload.meta ?? {} },

    // If neither source nor data exists, tuck source under meta
    { ...base, event: payload.name, ts: isoTs, meta: { ...(payload.meta ?? {}), source: payload.source ?? null } },
    { ...base, type: payload.name, ts: isoTs, meta: { ...(payload.meta ?? {}), source: payload.source ?? null } },
    { ...base, event_name: payload.name, ts: isoTs, meta: { ...(payload.meta ?? {}), source: payload.source ?? null } },
    { ...base, name: payload.name, ts: isoTs, meta: { ...(payload.meta ?? {}), source: payload.source ?? null } },
  ];

  let lastErr = null;
  for (const row of candidates) {
    const { error } = await sb.from('Events').insert(row); // use lowercase table name to match Postgres identifiers
    if (!error) return true; // success on first compatible shape
    lastErr = error;
    // Only keep trying when the error is a column-not-found type; otherwise bail
    // (Postgres invalid column: 42703; Supabase may surface it as a message string)
    const msg = (error.message || '').toLowerCase();
    if (!(msg.includes('column') && msg.includes('does not exist'))) break;
  }
  // We never fail the API because of telemetry; just surface for debugging
  console.error('safeLogEvent: could not insert telemetry row. last error =', lastErr);
  return false;
}

/** ---------- Handlers ---------- */
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

    // 3) telemetry: persist lead.created into events (schema-agnostic)
    await safeLogEvent(sb, {
      name: 'lead.created',
      ts: new Date().toISOString(),
      provider_id: prov.id,
      lead_id: leadRow.id,
      source: { via: 'api', ...source },
    });

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
