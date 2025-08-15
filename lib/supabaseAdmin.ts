// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the SERVICE_ROLE key.
 * - Bypasses RLS (needed for reliable server-side writes like telemetry).
 * - Never import this into client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        "X-Client-Info": "vyapr-admin",
      },
    },
  });
}
