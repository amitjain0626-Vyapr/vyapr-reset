// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type CreateLeadBody = {
  slug: string;
  patient_name: string;
  phone: string;
  note?: string;
  source?: Record<string, any>;
};

// Get provider + resolve back to root owner
async function getProviderWithOwner(slug: string) {
  // fetch provider
  const { data: prov, error: e1 } = await supabaseAdmin
    .from('Providers')
    .select('id, slug, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (e1) throw e1;
  if (!prov) return null;

  // If this row has no owner, fallback: find any provider row with same user
  if (!prov.owner_id) {
    const { data: root, error: e2 } = await supabaseAdmin
      .from('Providers')
      .select('owner_id')
      .not('owner_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (e2) throw e2;
    if (!root) return null;
    prov.owner_id = root.owner_id;
  }

  return prov;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateLeadBody;
    const { slug, patient_name, phone, note, source } = body || {};

    if (!slug || !patient_name || !phone) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const provider = await getProviderWithOwner(slug);
    if (!provider?.owner_id) {
      return NextResponse.json(
        { ok: false, error: 'Provider or owner not found' },
        { status: 404 }
      );
    }

    const ownerUserId = provider.owner_id as string;

    // Insert into Leads (FK -> auth.users.id)
    const leadRes = await supabaseAdmin
      .from('Leads')
      .insert([
        {
          owner_id: ownerUserId,
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

    // Append telemetry to Events
    const nowMs = Date.now();
    await supabaseAdmin.from('Events').insert([
      {
        event: 'lead.created',
        ts: nowMs,
        provider_id: ownerUserId,
        lead_id: leadId,
        source: source ?? { utm: {} },
      },
    ]);

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
