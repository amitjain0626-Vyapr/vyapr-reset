// lib/supabase/server-helpers.ts
// @ts-nocheck
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Named exactly as some files expect. */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: any) => {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );
}

/** Backward-compat alias some pages import. */
export const supabaseServer = createSupabaseServerClient;

/** Session guard used across actions/routes. */
export async function requireSession() {
  const sb = createSupabaseServerClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return { sb, session };
}
