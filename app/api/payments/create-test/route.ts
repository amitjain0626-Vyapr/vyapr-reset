// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();

  // Get signed-in user
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const user = userRes.user;

  // Insert a simple test row
  const payload = {
    owner_id: user.id,
    amount: 500.0,
    currency: 'INR',
    status: 'pending',
    method: 'upi',
    source: 'microsite',
    payer_name: 'Test Payer',
    phone: '+919999999999',
    note: 'Test payment via dashboard button',
  };

  const { data, error } = await supabase.from('Payments').insert(payload).select('id').single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
