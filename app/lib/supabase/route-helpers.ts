// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// WRITE-ENABLED client for Route Handlers (/app/api/**)
// Next allows cookies().set/delete here.
export async function createSupabaseRouteClient() {
  const cookieStore = cookies(); // sync OK in route handlers

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          // delete() is allowed; fallback to expired cookie if needed
          try {
            // @ts-ignore
            cookieStore.delete?.(name, options);
          } catch {
            cookieStore.set(name, "", { ...options, expires: new Date(0) });
          }
        },
      },
    }
  );

  return supabase;
}

// 👇 LOGGING FUNCTION used by all route handlers
export function logServerRoute(route: string) {
  console.log(`[📡] API route hit: ${route}`);
}
