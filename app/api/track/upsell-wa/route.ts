// @ts-nocheck
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const provider_id = (searchParams.get('provider_id') || '').trim();
    const phoneRaw = (searchParams.get('phone') || '').trim();
    const textRaw = (searchParams.get('text') || '').trim();

    const utm_source = (searchParams.get('utm_source') || '').trim();
    const utm_medium = (searchParams.get('utm_medium') || '').trim();
    const utm_campaign = (searchParams.get('utm_campaign') || '').trim();
    const tier = (searchParams.get('tier') || '').trim();
    const ref = (searchParams.get('ref') || '').trim(); // NEW

    const digits = phoneRaw.replace(/[^\d]/g, '');
    const msg = encodeURIComponent(textRaw || '');

    // Use api.whatsapp.com variant (more stable) and include standard params
    const waUrl =
      `https://api.whatsapp.com/send/?phone=${digits}` +
      `&text=${msg}&type=phone_number&app_absent=0`;

    // telemetry (best-effort)
    const sb = admin();
    await sb.from('Events').insert({
      event: 'upsell.wa.clicked',
      ts: Date.now(),
      provider_id: provider_id || null,
      lead_id: null,
      source: {
        channel: 'wa',
        target: digits,
        utm: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
        tier,
        ref, // NEW
      },
    });

    return NextResponse.redirect(waUrl, 302);
  } catch {
    return NextResponse.redirect('https://api.whatsapp.com/send/', 302);
  }
}
