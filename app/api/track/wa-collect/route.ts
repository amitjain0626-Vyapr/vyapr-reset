// app/api/track/wa-collect/route.ts
// @ts-nocheck
export const runtime = "nodejs";            // ← INSERT: ensure Node (Buffer available)
export const dynamic = "force-dynamic";     // ← INSERT: avoid caching variability

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// INSERT: base64url encoder (no throws)
function b64url(input: string): string {
  // eslint-disable-next-line no-undef
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// INSERT: build /r/x?u=...&s=... against our BASE
function shortLinkOf(longUrl: string, slug?: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    'https://vyapr-reset-5rly.vercel.app';
  const u = b64url(longUrl);
  const s = slug ? `&s=${encodeURIComponent(slug)}` : '';
  return `${base}/r/x?u=${u}${s}`;
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

    // INSERT (optional): accept a long link to append as a short /r/x
    const linkRaw = (searchParams.get('link') || '').trim();
    const slug =
      (searchParams.get('slug') || searchParams.get('provider_slug') || '').trim();

    const digits = phoneRaw.replace(/[^\d]/g, '');

    // INSERT: compose message (append short link when provided & valid)
    let composed = textRaw || '';
    if (/^https?:\/\//i.test(linkRaw)) {
      try {
        const short = shortLinkOf(linkRaw, slug || undefined);
        composed = (composed ? `${composed} ` : '') + short;
    } catch { /* ignore encoding errors; fall back */ }
    }

    const msg = encodeURIComponent(composed);

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
