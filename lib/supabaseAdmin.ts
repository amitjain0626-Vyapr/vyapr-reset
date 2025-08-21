// lib/supabaseAdmin.ts
// Server-only Supabase admin client (Service Role). Do NOT import in client components.
// @ts-nocheck

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!; // set in Vercel

if (!SUPABASE_URL) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE");
}

export function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "vyapr-admin" },
    },
  });
}

// Export default too, so both `import { createAdminClient } ...` and `import createAdminClient ...` work.
export default createAdminClient;
