'use server';

// @ts-nocheck
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type UpdatePaymentInput = {
  id: string;
  note?: string | null;
  status?: string | null; // keep flexible to match your enum/text
};

export async function updatePayment(input: UpdatePaymentInput) {
  const supabase = await createSupabaseServerClient();

  const { id, note, status } = input;

  const updates: Record<string, unknown> = {};
  if (typeof note !== 'undefined') updates.note = note;
  if (typeof status !== 'undefined') updates.status = status;

  const { error } = await supabase.from('Payments').update(updates).eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/payments');
  return { ok: true };
}
