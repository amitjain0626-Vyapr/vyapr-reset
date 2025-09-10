// lib/supabaseAdmin.ts
// Server-only Supabase admin client (Service Role). Do NOT import in client components.
// This version does NOT throw at import time — it validates envs only when called.
// @ts-nocheck

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Throw only when a route actually tries to use the admin client
    throw new Error(
      "Missing envs for admin client: " +
        (!SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL " : "") +
        (!SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY" : "")
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "korekko-admin" } },
  });
}

// Also export default for flexibility
export default createAdminClient;
