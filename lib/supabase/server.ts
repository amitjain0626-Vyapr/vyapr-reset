// lib/supabase/server.ts
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

export function getSupabaseServer() {
  return createSupabaseServerClient();
}

export function getServerSupabase() {
  return createSupabaseServerClient();
}
