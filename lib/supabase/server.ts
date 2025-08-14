// lib/supabase/server.ts
// Next.js 15 + @supabase/ssr cookie adapter (server-side)
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Main server-side Supabase client creator.
 * Works in Next.js App Router with @supabase/ssr.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // next/headers cookies().set signature
          // @ts-ignore
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });

  return supabase;
}

/**
 * Alias for newer imports in our current code.
 */
export async function getSupabaseServer() {
  return createSupabaseServerClient();
}

/**
 * Backward-compatibility alias for older imports.
 * Some older files still import `getServerSupabase`.
 */
export async function getServerSupabase() {
  return createSupabaseServerClient();
}
