// app/login/actions.ts
// @ts-nocheck
'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) return;

  const supabase = createSupabaseServerClient();
  // Fallback SITE URL if env not set
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://vyapr-reset-5rly.vercel.app';

  await supabase.auth.signInWithOtp({
    email,
    options: {
      // This sets redirect_to inside ConfirmationURL fallback; our template now uses token_hash anyway.
      emailRedirectTo: `${site}/auth/callback`,
    },
  });
}
