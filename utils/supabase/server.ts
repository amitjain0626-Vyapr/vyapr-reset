// utils/supabase/server.ts
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ✅ named export exactly: createClient
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // modern API — no-ops are fine server-side
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},

        // fallback to satisfy variants during build
        getAll() {
          const list = cookieStore.getAll?.() || [];
          return Array.from(list).map((c: any) => ({ name: c.name, value: c.value }));
        },
        setAll(_cookiesToSet: { name: string; value: string; options: any }[]) {
          // noop; cookies may be readonly at build time
        },
      },
    }
  );
}
