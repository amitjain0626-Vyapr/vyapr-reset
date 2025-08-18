// @ts-nocheck
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const payload = {
    owner_id: user.id,
    amount: 500.0,
    currency: 'INR',
    status: 'pending',
    source: 'microsite',
    payer_name: 'Test Payer',
    phone: '+919999999999',
    note: 'Test payment via dashboard button',
    provider_order_id: randomUUID(), // ✅ app-side fallback, always present
  };

  const { data, error } = await supabase
    .from('Payments')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
