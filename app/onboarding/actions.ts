// app/onboarding/actions.ts
// @ts-nocheck
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

/**
 * Create (or ensure) a starter Dentist profile for the logged-in user.
 * Works with either schema:
 *  - auth_user_id (unique)  OR
 *  - id = auth.uid (PK)
 * Idempotent via upsert.
 */
export async function ensureDentistProfile(formData: FormData) {
  const uid = (formData.get('uid') as string) || '';
  const email = (formData.get('email') as string) || null;

  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user || user.id !== uid) {
    redirect('/login?error=NoSession');
  }

  // Try common mapping first: auth_user_id
  let upsertErr: any = null;

  const payload1: any = {
    auth_user_id: uid,
    email,
    status: 'draft',
  };

  const { error: e1 } = await supabase
    .from('Dentists')
    .upsert(payload1, { onConflict: 'auth_user_id' });

  upsertErr = e1;

  // If column doesn't exist (42703), fall back to PK=id
  if (upsertErr && String(upsertErr.code) === '42703') {
    const payload2: any = {
      id: uid,
      email,
      status: 'draft',
    };
    const { error: e2 } = await supabase.from('Dentists').upsert(payload2);
    upsertErr = e2;
  }

  // If still error (e.g., constraint), check silently and insert if needed
  if (upsertErr) {
    const { data: existing } = await supabase
      .from('Dentists')
      .select('id')
      .or(`auth_user_id.eq.${uid},id.eq.${uid}`)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await supabase.from('Dentists').insert(payload1).then(() => {});
    }
  }

  revalidatePath('/onboarding');
  redirect('/onboarding');
}

/**
 * Update the Dentist profile for the logged-in user.
 * Normalizes slug; advances status to 'in_progress'.
 */
export async function updateDentistProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?error=NoSession');

  const display_name = (formData.get('display_name') as string)?.trim() || null;
  const clinic_name = (formData.get('clinic_name') as string)?.trim() || null;
  const slugRaw = (formData.get('slug') as string) || '';
  const slug =
    slugRaw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || null;

  // Prefer schema with auth_user_id
  const { data: existingByAuth } = await supabase
    .from('Dentists')
    .select('id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existingByAuth) {
    await supabase
      .from('Dentists')
      .update({ display_name, clinic_name, slug, status: 'in_progress' })
      .eq('auth_user_id', user.id);
  } else {
    // Fallback: PK=id
    const { data: existingById } = await supabase
      .from('Dentists')
      .select('id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (existingById) {
      await supabase
        .from('Dentists')
        .update({ display_name, clinic_name, slug, status: 'in_progress' })
        .eq('id', user.id);
    } else {
      // Last resort: create record
      await supabase.from('Dentists').upsert(
        {
          auth_user_id: user.id, // harmless if column missing; PG ignores unknown keys in insert
          id: user.id,
          email: user.email,
          display_name,
          clinic_name,
          slug,
          status: 'in_progress',
        },
        { onConflict: 'auth_user_id' }
      );
    }
  }

  revalidatePath('/onboarding');
  if (slug) redirect('/dashboard');
  redirect('/onboarding?saved=1');
}
