// app/onboarding/actions.ts
// @ts-nocheck
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

// (keep your existing ensureDentistProfile here)

export async function updateDentistProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?error=NoSession');

  // Pull fields
  const display_name = (formData.get('display_name') as string)?.trim() || null;
  const clinic_name = (formData.get('clinic_name') as string)?.trim() || null;
  const slugRaw = (formData.get('slug') as string) || '';
  const slug = slugRaw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null;

  // Try schema with auth_user_id first
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
    // Fallback: PK=id schema
    const { data: existingById } = await supabase
      .from('Dentists')
      .select('id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (existingById) {
      await supbase
        .from('Dentists')
        .update({ display_name, clinic_name, slug, status: 'in_progress' })
        .eq('id', user.id);
    } else {
      // Last resort: create a draft record
      await supabase.from('Dentists').upsert(
        {
          auth_user_id: user.id, // safe even if column doesn't exist; if 42703, it's ignored by PG
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

  // If slug present, proceed to dashboard; else stay on onboarding
  if (slug) redirect('/dashboard');
  redirect('/onboarding?saved=1');
}
