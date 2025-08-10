// lib/supabase/client-helpers.ts
// @ts-nocheck
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/** Server-side Supabase (RLS via auth cookies). */
export function supabaseServer() {
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

/** Node-only Admin client (service role) for server routes/actions. */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { 'X-Client-Info': 'vyapr-admin' } },
    }
  );
}

/** Common server-route logger (keeps import compatibility). */
export function logServerRoute(label: string, extra?: any) {
  try {
    const payload =
      extra && typeof extra === 'object' ? JSON.stringify(extra) : String(extra ?? '');
    console.log(`[SRV] ${label}${payload ? ` :: ${payload}` : ''}`);
  } catch {
    console.log(`[SRV] ${label}`);
  }
}

/** Small helper used by some routes. */
export async function requireSession() {
  const sb = supabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return { sb, session };
}
