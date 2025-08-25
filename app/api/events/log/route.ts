// app/api/events/log/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

// 1) GET healthcheck so curl doesn't return empty
export async function GET() {
  return NextResponse.json({ ok: true });
}

// 2) POST already works for telemetry; keeping it here so nothing breaks
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const ALLOWED = new Set([
  'wa.reminder.sent',
  'wa.rebook.sent',
  'nudge.suggested',
  'note.provider.added',
  'note.customer.added',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event: string = body.event;
    if (!ALLOWED.has(event)) {
      return NextResponse.json({ ok: false, error: 'event_not_allowed' }, { status: 400 });
    }

    const ts: number = typeof body.ts === 'number' ? body.ts : Date.now();
    const lead_id: string | null = body.lead_id ?? null;
    const source = body.source ?? { via: 'ui' };
    let provider_id: string | null = body.provider_id ?? null;

    const sb = admin();

    if (!provider_id && body.provider_slug) {
      const { data: prov } = await sb.from('Providers').select('id').eq('slug', body.provider_slug).limit(1).single();
      provider_id = prov?.id ?? null;
    }
    if (!provider_id) {
      return NextResponse.json({ ok: false, error: 'missing_provider_id' }, { status: 400 });
    }

    const { error } = await sb.from('Events').insert({ event, ts, provider_id, lead_id, source });
    if (error) return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
}
