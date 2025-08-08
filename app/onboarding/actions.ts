// app/onboarding/actions.ts
// @ts-nocheck
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

export async function ensureDentistProfile(formData: FormData) {
  const uid = (formData.get('uid') as string) || '';
  const email = (formData.get('email') as string) || null;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== uid) redirect('/login?error=NoSession');

  // Pure ID schema (no auth_user_id)
  await supabase.from('Dentists').upsert(
    {
      id: uid,
      email,
      status: 'draft',
    },
    { onConflict: 'id' }
  );

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

export async function updateDentistProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?error=NoSession');

  const display_name = (formData.get('display_name') as string)?.trim() || null;
  const clinic_name = (formData.get('clinic_name') as string)?.trim() || null;
  const slugRaw = (formData.get('slug') as string) || '';
  const slug = slugRaw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null;

  // Update by ID only
  await supabase
    .from('Dentists')
    .update({ display_name, clinic_name, slug, status: 'in_progress' })
    .eq('id', user.id);

  revalidatePath('/onboarding');
  if (slug) redirect('/dashboard');
  redirect('/onboarding?saved=1');
}
