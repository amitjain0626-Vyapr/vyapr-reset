// app/api/leads/create/route.ts
// @ts-nocheck
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendLeadEmail } from '@/lib/notify';

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}
function sanitizePhone(p: string) {
  const trimmed = p.replace(/[\s-]/g, '');
  if (!/^\+?\d{7,15}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name ?? '').toString().trim();
    const phoneRaw = (body?.phone ?? '').toString().trim();
    const note = (body?.note ?? '').toString().trim();
    const slug = (body?.slug ?? body?.micrositeSlug ?? '').toString().trim().toLowerCase();

    if (!slug) return bad('Missing microsite slug');
    if (!name) return bad('Name is required');
    const phone = sanitizePhone(phoneRaw);
    if (!phone) return bad('Invalid phone number');

    // 1) Resolve dentist by microsite slug
    const { data: dentist, error: dErr } = await supabaseAdmin
      .from('Dentists')
      .select('id, user_id, slug, display_name')
      .eq('slug', slug)
      .maybeSingle();
    if (dErr) return bad('Dentist lookup failed', 500);
    if (!dentist) return bad('Microsite not found', 404);

    // 2) Insert lead
    const payload: any = {
      owner_id: dentist.user_id,
      dentist_id: dentist.id ?? null,
      name,
      phone,
      note,
      microsite_slug: slug,
      source: 'microsite',
    };
    const { data: ins, error: iErr } = await supabaseAdmin
      .from('Leads')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (iErr) return bad('Could not create lead', 500);

    // 3) Fetch dentist’s account email (via admin) and notify
    let dentistEmail: string | null = null;
    try {
      const { data: ures, error: uerr } = await supabaseAdmin.auth.admin.getUserById(
        dentist.user_id
      );
      if (!uerr) dentistEmail = ures?.user?.email ?? null;
    } catch {
      // ignore — we’ll just log if no email found
    }

    try {
      await sendLeadEmail({
        toEmail: dentistEmail,
        dentistName: dentist.display_name ?? null,
        micrositeSlug: slug,
        patientName: name,
        patientPhone: phone,
        note,
      });
    } catch (e) {
      // Don’t fail the API if email fails
      console.warn('notify error', e);
    }

    return NextResponse.json({ ok: true, id: ins?.id ?? null }, { status: 201 });
  } catch {
    return bad('Unexpected server error', 500);
  }
}
