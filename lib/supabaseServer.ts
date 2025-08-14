// @ts-nocheck
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client that reads/writes the auth cookies via Next's cookies()
export function getSupabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Ensure the cookie changes propagate in the route handler response
          store.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          store.set({ name, value: "", ...options });
        },
      },
    }
  );
}
