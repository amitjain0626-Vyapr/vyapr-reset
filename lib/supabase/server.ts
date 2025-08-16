// @ts-nocheck
// lib/supabase/server.ts
//
// Backward-compatible server-side Supabase client.
// Exports aliases for legacy imports used across the codebase:
// - getServerSupabase
// - getSupabaseServer
// - default export (createSupabaseServerClient)

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const headerStore = headers();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // ignore on edge
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // ignore on edge
          }
        },
      },
      global: {
        headers: {
          "x-forwarded-for": headerStore.get("x-forwarded-for") || "",
          "x-request-id": headerStore.get("x-request-id") || "",
        },
      },
    }
  );

  return supabase;
}

// ---- legacy aliases (keep old imports working) ----
export const getServerSupabase = createSupabaseServerClient;
export const getSupabaseServer = createSupabaseServerClient;
export default createSupabaseServerClient;
