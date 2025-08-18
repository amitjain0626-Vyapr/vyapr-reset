// lib/supabase/server.ts
// @ts-nocheck
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client that:
 * - Reads auth cookies (sb-access-token / sb-refresh-token) from Next.js
 * - Allows cookie refresh (set/remove) in Route Handlers / Server Components
 * - Works in Node runtime (avoid Edge for auth-protected DB calls)
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // In Route Handlers, cookies are mutable; in RSC they may be readonly.
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // ignore if not mutable in current context
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {
            // ignore if not mutable
          }
        },
      },
      global: {
        headers: {
          // helps with tracing + forwards request context to Supabase if useful
          ...(Object.fromEntries(headers().entries())),
          "X-Client-Info": "vyapr-server",
        },
      },
    }
  );

  return supabase;
}
