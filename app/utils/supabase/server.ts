// app/utils/supabase/server.ts
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// This file exports ONE thing: createClient
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op on server
        },
        remove() {
          // no-op on server
        },
      },
    }
  );
}
