'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server'; // already working per Step 7

type UpdateLeadInput = {
  id: string;
  note?: string | null;
  status?: 'new' | 'open' | 'closed';
};

export async function updateLead(input: UpdateLeadInput) {
  const supabase = await createSupabaseServerClient(cookies());
  const { id, note, status } = input;

  const updates: Record<string, unknown> = {};
  if (typeof note !== 'undefined') updates.note = note;
  if (typeof status !== 'undefined') updates.status = status;

  const { error } = await supabase
    .from('Leads')
    .update(updates)
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/leads');
  return { ok: true };
}
