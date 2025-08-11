'use server';
// @ts-nocheck
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '../../../lib/supabase/server';

export async function createLead(formData: FormData) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  const name = (formData.get('name') || '').toString().trim();
  const phone = (formData.get('phone') || '').toString().trim() || undefined;
  const note  = (formData.get('note')  || '').toString().trim() || undefined;
  const source= (formData.get('source')|| '').toString().trim() || undefined;

  if (!name) return { ok: false, error: 'NAME_REQUIRED' };

  const { error } = await supabase
    .from('Leads')
    .insert([{ name, phone, note, source }]); // user_id set by trigger

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/leads');
  return { ok: true };
}
