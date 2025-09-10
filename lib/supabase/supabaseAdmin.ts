// lib/supabaseAdmin.ts
// Server-only Supabase admin client (uses Service Role key)
// Never import this in Client Components.
// @ts-nocheck

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!; // unified name

if (!SUPABASE_URL) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
}

export function createAdminClient() {
  // Admin client: no session persistence on server
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "korekko-admin",
      },
    },
  });
}
