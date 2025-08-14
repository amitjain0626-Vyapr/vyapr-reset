// lib/supabase/server.ts
// Next.js 15 + @supabase/ssr cookie adapter (server-side)
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Core creator — returns a Supabase client ready for server usage.
 * Now synchronous for drop-in compatibility across all imports.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // @ts-ignore
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });
}

/**
 * Alias for newer imports in our current code.
 */
export function getSupabaseServer() {
  return createSupabaseServerClient();
}

/**
 * Backward-compatibility alias for older imports.
 */
export function getServerSupabase() {
  return createSupabaseServerClient();
}
