// app/api/templates/preview/route.ts
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { waReminder, waRebook } from '@/lib/wa/templates';

/** Minimal WA URL helper (local to this route) */
function waUrlFor(phone: string, text: string) {
  const digits = (phone || '').replace(/[^\d]/g, '');
  const msg = encodeURIComponent(text || '');
  if (!digits) return `https://api.whatsapp.com/send/?text=${msg}&type=phone_number&app_absent=0`;
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${msg}&type=phone_number&app_absent=0`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const template = (url.searchParams.get('template') || '').trim().toLowerCase(); // 'collect_pending' | 'rebook'
    const lang = ((url.searchParams.get('lang') || 'en').trim().toLowerCase()) as 'en'|'hi'|'hinglish';

    // optional hints
    const amt = url.searchParams.get('amt');
    const name = url.searchParams.get('name') || 'there';
    const provider = url.searchParams.get('provider') || ''; // optional
    const category = url.searchParams.get('category') || ''; // optional (dentist, physio, etc.)
    const service = url.searchParams.get('service') || ''; // optional
    const link = url.searchParams.get('link') || '';       // optional override
    const phone = url.searchParams.get('phone') || '';     // optional, for WA URL

    let text = '';

    // two lines before
    // Template switch: collect_pending (reminder) vs rebook (missed last time)
    // Uses new lib/wa/templates with TG-aware phrases.
    // << insert >>
    // V2.3: use server-authored copy (short, neutral, category-aware), append link when provided
    // and finally compute a single whatsapp_url (no duplicate const!)
    // two lines after
    if (template === 'collect_pending') {
      text = waReminder(
        {
          name,
          provider: provider || undefined,
          amountINR: amt ? Number(amt) : undefined,
          category: category || null,
          topService: service || null,
        },
        lang
      );
    } else if (template === 'rebook') {
      text = waRebook(
        {
          name,
          provider: provider || undefined,
          category: category || null,
          topService: service || null,
        },
        lang
      );
    } else {
      // fallback to a minimal, safe line
      text = 'Hi, this is your service provider’s team.';
    }

    // append link when present (kept outside template for reuse)
    if (link && !/\s$/.test(text)) {
      text = `${text} ${link}`;
    } else if (link) {
      text = `${text}${link}`;
    }

    const whatsapp_url = waUrlFor(phone, text);

    return NextResponse.json({
      ok: true,
      slug,
      template,
      language: lang,
      preview: {
        text,
        whatsapp_url,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'server_error' }, { status: 500 });
  }
}
