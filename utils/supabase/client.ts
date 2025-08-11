// utils/supabase/client.ts
// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

/** Optional browser client (if any client components import it) */
export function createSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Back-compat default export */
export const supabaseClient = createSupabaseBrowserClient();
