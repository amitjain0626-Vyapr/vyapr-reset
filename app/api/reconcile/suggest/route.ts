// app/api/reconcile/suggest/route.ts
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Heuristic:
 * - Look for recent payment events (payment.success OR receipt sent) in last 14d.
 * - Try to extract `lead:<id>` from source.note (or fallback to search in note string).
 * - If not present, match by phone (when available) or fuzzy name (if we store names in source).
 * - Return suggestions with confidence ∈ {1.0 direct, 0.8 phone, 0.5 fuzzy}.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') || '').trim();
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 5)));

    if (!slug) return NextResponse.json({ ok: false, error: 'missing_slug' }, { status: 400 });

    const sb = admin();

    // provider
    const { data: provider, error: pErr } = await sb
      .from('Providers')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    if (pErr || !provider?.id) {
      return NextResponse.json({ ok: false, error: 'provider_not_found' }, { status: 404 });
    }

    const providerId = provider.id;
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000;

    // fetch latest payment-like events (success or receipt)
    const { data: payEvents = [] } = await sb
      .from('Events')
      .select('id, ts, event, lead_id, source')
      .eq('provider_id', providerId)
      .in('event', ['payment.success', 'payment.receipt.sent'])
      .gte('ts', since)
      .order('ts', { ascending: false })
      .limit(200);

    // build a quick lead map
    const leadIds = Array.from(new Set(payEvents.map((e: any) => e.lead_id).filter(Boolean)));
    const { data: leads = [] } = await sb
      .from('Leads')
      .select('id, phone, patient_name')
      .in('id', leadIds.length ? leadIds : ['00000000-0000-0000-0000-000000000000']); // never empty

    const byId: Record<string, any> = {};
    for (const l of leads) byId[l.id] = l;

    const out: any[] = [];

    for (const e of payEvents) {
      const src = e?.source || {};
      const note = String(src?.note || src?.tn || src?.text || '');
      const phoneInEvent = String(src?.phone || '').replace(/[^\d]/g, '');

      // 1) Direct parse: "lead:<uuid>" inside note/tn
      let parsedLead: string | null = null;
      const m = note.match(/lead:([0-9a-fA-F-]{8,})/);
      if (m && m[1]) parsedLead = m[1];

      if (parsedLead) {
        out.push({
          lead_id: parsedLead,
          payment_event_id: e.id,
          confidence: 1.0,
          why: 'lead-id-in-note',
          payment_ref: src?.ref || null,
          phone: phoneInEvent || (byId[parsedLead]?.phone || null),
          name: byId[parsedLead]?.patient_name || null,
          ts: e.ts,
        });
        continue;
      }

      // 2) Use event.lead_id when present (fallback)
      if (e.lead_id) {
        out.push({
          lead_id: e.lead_id,
          payment_event_id: e.id,
          confidence: 0.9,
          why: 'event.lead_id-present',
          payment_ref: src?.ref || null,
          phone: phoneInEvent || (byId[e.lead_id]?.phone || null),
          name: byId[e.lead_id]?.patient_name || null,
          ts: e.ts,
        });
        continue;
      }

      // 3) Phone-based hint (if pay note has phone)
      if (phoneInEvent) {
        // find any lead with same phone (recent)
        const { data: samePhone = [] } = await sb
          .from('Leads')
          .select('id, phone, patient_name')
          .eq('provider_id', providerId)
          .eq('phone', phoneInEvent)
          .order('created_at', { ascending: false })
          .limit(1);

        if (samePhone[0]?.id) {
          out.push({
            lead_id: samePhone[0].id,
            payment_event_id: e.id,
            confidence: 0.8,
            why: 'matched-phone',
            payment_ref: src?.ref || null,
            phone: phoneInEvent,
            name: samePhone[0]?.patient_name || null,
            ts: e.ts,
          });
          continue;
        }
      }

      // 4) Fuzzy (name in note vs recent leads)
      const nameFromNote = (() => {
        const nm = note.match(/name:([^|]+)/i);
        return nm ? nm[1].trim() : '';
      })();
      if (nameFromNote) {
        const { data: nameHit = [] } = await sb
          .from('Leads')
          .select('id, patient_name, phone')
          .eq('provider_id', providerId)
          .ilike('patient_name', `%${nameFromNote}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (nameHit[0]?.id) {
          out.push({
            lead_id: nameHit[0].id,
            payment_event_id: e.id,
            confidence: 0.5,
            why: 'fuzzy-name',
            payment_ref: src?.ref || null,
            phone: nameHit[0]?.phone || null,
            name: nameHit[0]?.patient_name || null,
            ts: e.ts,
          });
        }
      }
    }

    // Top N
    out.sort((a, b) => (b.confidence === a.confidence ? (b.ts || 0) - (a.ts || 0) : b.confidence - a.confidence));
    return NextResponse.json({ ok: true, suggestions: out.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown_error' }, { status: 500 });
  }
}
