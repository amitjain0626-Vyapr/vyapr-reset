// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Server-only admin client (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type CreateLeadBody = {
  slug: string;                 // public handle
  patient_name: string;
  phone: string;
  note?: string;
  source?: Record<string, any>;
};

async function getProviderBySlug(slug: string) {
  // IMPORTANT: fetch owner_id (auth.users.id)
  const { data, error } = await supabaseAdmin
    .from('Providers')
    .select('id, slug, display_name, owner_id') // <-- owner_id must exist on Providers
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateLeadBody;
    const { slug, patient_name, phone, note, source } = body || {};

    if (!slug || !patient_name || !phone) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: slug, patient_name, phone' },
        { status: 400 }
      );
    }

    const provider = await getProviderBySlug(slug);
    if (!provider?.owner_id) {
      return NextResponse.json(
        { ok: false, error: 'Provider not found or owner missing' },
        { status: 404 }
      );
    }

    const ownerUserId = provider.owner_id as string; // auth.users.id

    // 1) Insert into Leads (FK -> auth.users.id)
    const leadRes = await supabaseAdmin
      .from('Leads')
      .insert([
        {
          owner_id: ownerUserId,     // ✅ correct FK target
          patient_name,
          phone,
          note: note ?? null,
          source: source ?? {},
        },
      ])
      .select('id')
      .single();

    if (leadRes.error) {
      return NextResponse.json(
        { ok: false, error: 'Insert failed', details: leadRes.error.message },
        { status: 500 }
      );
    }

    const leadId = leadRes.data.id as string;

    // 2) Append telemetry to Events (RLS reads use auth.uid())
    const nowMs = Date.now();
    const evt = await supabaseAdmin
      .from('Events')
      .insert([
        {
          event: 'lead.created',
          ts: nowMs,
          provider_id: ownerUserId, // ✅ match auth.uid()
          lead_id: leadId,
          source: source ?? { utm: {} },
        },
      ])
      .select('id')
      .single();

    if (evt.error) {
      console.error('[telemetry] events.insert failed', evt.error.message);
    }

    // WhatsApp deep link (fail-open)
    const digits = (phone || '').replace(/[^\d]/g, '');
    const waNum = digits.startsWith('91') ? digits : `91${digits}`;
    const waText = encodeURIComponent(`Hi, I'd like to book a slot.`);
    const whatsapp_url = `https://wa.me/${waNum}?text=${waText}`;

    return NextResponse.json({
      ok: true,
      id: leadId,
      provider_slug: slug,
      whatsapp_url,
    });
  } catch (err) {
    console.error('POST /api/leads/create error', err);
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}
