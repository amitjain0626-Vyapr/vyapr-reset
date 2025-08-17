// utils/supabase/admin.ts
// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

// ⚠️ Requires SUPABASE_SERVICE_ROLE_KEY in your env (server-only)
// This client bypasses RLS. Use ONLY in server code.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "vyapr-admin" } },
  }
);
