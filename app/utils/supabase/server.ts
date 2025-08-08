// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// READ-ONLY client for Server Components (page.tsx/layout.tsx)
// Never writes cookies here (no set/delete) to avoid Next 15 restriction.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // using your async-safe pattern

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Block writes in server components
        set() {},
        remove() {},
      },
    }
  );

  return supabase;
}
