// utils/supabase/client/index.ts
// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

export function createSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabaseClient = createSupabaseBrowserClient();
export default createSupabaseBrowserClient;
