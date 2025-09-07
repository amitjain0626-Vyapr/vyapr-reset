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
    const lead_id = (searchParams.get('lead_id') || '').trim();
    const phoneRaw = (searchParams.get('phone') || '').trim();
    const textRaw = (searchParams.get('text') || '').trim();
    const ref = (searchParams.get('ref') || '').trim(); // NEW

    const digits = phoneRaw.replace(/[^\d]/g, '');
    const msg = encodeURIComponent(textRaw || '');

    // More stable variant than wa.me
    const waUrl =
      `https://api.whatsapp.com/send/?phone=${digits}` +
      `&text=${msg}&type=phone_number&app_absent=0`;

    // telemetry (best-effort)
    try {
      await admin().from('Events').insert({
        event: 'wa.reminder.sent',
        ts: Date.now(),
        provider_id: provider_id || null,
        lead_id: lead_id || null,
        source: { channel: 'wa', target: digits, ref },
      });
    } catch {}

    return NextResponse.redirect(waUrl, 302);
  } catch {
    return NextResponse.redirect('https://api.whatsapp.com/send/', 302);
  }
}
