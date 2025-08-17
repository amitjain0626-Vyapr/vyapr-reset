// app/utils/supabase/server.ts
// @ts-nocheck
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server-side Supabase client that can READ and WRITE cookies in route handlers.
// In server components cookies() is readonly; we soft-handle that with try/catch.
export function createClient() {
  const cookieStore = nextCookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // read one
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch {
            return undefined;
          }
        },
        // write/overwrite
        set(name: string, value: string, options: any) {
          try {
            // In route handlers, cookies() is mutable.
            cookieStore.set(name, value, options);
          } catch {
            // In server components, it's readonly — ignore.
          }
        },
        // remove
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // readonly context — ignore
          }
        },

        // fallback methods for older @supabase/ssr builds during prerender
        getAll() {
          try {
            const list = cookieStore.getAll?.() || [];
            return Array.from(list).map((c: any) => ({ name: c.name, value: c.value }));
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            for (const c of cookiesToSet) {
              cookieStore.set(c.name, c.value, c.options);
            }
          } catch {
            // readonly context — ignore
          }
        },
      },
    }
  );
}
