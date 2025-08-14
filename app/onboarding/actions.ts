// app/onboarding/actions.ts
// @ts-nocheck
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Create a profile row if missing (schema: user_id, name, slug, phone, city)
 */
export async function ensureDentistProfile(formData: FormData) {
  const uid = String(formData.get('uid') || '');

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== uid) redirect('/login?error=NoSession');

  // 1) Check if exists
  const { data: existing } = await supabase
    .from('Dentists')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle();

  if (!existing) {
    // 2) Insert minimal draft row
    const { error: insErr } = await supabase.from('Dentists').insert([
      {
        user_id: uid,
        name: 'New Dentist',
        slug: null,
        phone: null,
        city: null,
      },
    ]);

    // If RLS blocks insert, we’ll fix with SQL below.
    if (insErr) {
      redirect(`/onboarding?error=${encodeURIComponent(insErr.message)}`);
    }
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

/**
 * Save profile fields; enforce slug uniqueness; go to /dashboard if slug present.
 */
export async function updateDentistProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=NoSession');

  const name = String(formData.get('name') || '').trim();
  const slugRaw = String(formData.get('slug') || '').trim().toLowerCase();
  const phone = String(formData.get('phone') || '').trim() || null;
  const city = String(formData.get('city') || '').trim() || null;

  const slug =
    slugRaw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || null;

  // Enforce uniqueness (excluding my own row)
  if (slug) {
    const { data: taken } = await supabase
      .from('Dentists')
      .select('id, user_id')
      .eq('slug', slug)
      .neq('user_id', user.id)
      .maybeSingle();

    if (taken) {
      redirect('/onboarding?error=SlugTaken');
    }
  }

  const { error: updErr } = await supabase
    .from('Dentists')
    .update({
      name: name || 'New Dentist',
      slug,
      phone,
      city,
    })
    .eq('user_id', user.id);

  if (updErr) {
    redirect(`/onboarding?error=${encodeURIComponent(updErr.message)}`);
  }

  revalidatePath('/onboarding');
  if (slug) redirect('/dashboard');
  redirect('/onboarding?saved=1');
}
