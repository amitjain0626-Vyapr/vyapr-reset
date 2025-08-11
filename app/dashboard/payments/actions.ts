'use server';
// @ts-nocheck
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '../../../lib/supabase/server';

export async function createPayment(formData: FormData) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  const patient = (formData.get('patient') || '').toString().trim() || undefined;
  const amountRaw = (formData.get('amount') || '').toString().trim();
  const status  = (formData.get('status')  || '').toString().trim() || 'pending';
  const method  = (formData.get('method')  || '').toString().trim() || undefined;
  const notes   = (formData.get('notes')   || '').toString().trim() || undefined;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'AMOUNT_INVALID' };

  const { error } = await supabase
    .from('Payments')
    .insert([{ patient, amount, status, method, notes }]); // user_id via trigger

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/payments');
  return { ok: true };
}
