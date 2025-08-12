'use server';

// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createBooking(formData: FormData) {
  const slug = String(formData.get('slug') || '').trim();
  const patient_name = String(formData.get('patient_name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const note = String(formData.get('note') || '').trim();

  if (!slug || !patient_name || !phone || phone.length < 10) {
    redirect(`/dentist/${slug}?error=validation`);
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data: dentist, error: dentistErr } = await supabase
    .from('dentists')
    .select('id, name, city, slug')
    .eq('slug', slug)
    .single();

  if (dentistErr || !dentist?.id) {
    redirect(`/dentist/${slug}?error=dentist_not_found`);
  }

  const { data: booking, error: insertErr } = await supabase
    .from('bookings')
    .insert({
      dentist_id: dentist.id,
      patient_name,
      phone,
      note,
    })
    .select('id')
    .single();

  if (insertErr || !booking?.id) {
    redirect(`/dentist/${slug}?error=insert_failed`);
  }

  // Success -> go to confirmation
  redirect(`/book/confirm?ref=${booking.id}&slug=${slug}`);
}
